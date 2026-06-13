const stripe = require('../config/stripe')
const { pool } = require('../config/db')
const { AppError } = require('../../../../shared/errorHandler')
const { createProducer, TOPICS, EVENT_TYPES } = require('../../../../shared/kafkaClient')
const logger = require('../../../../shared/logger')

let kafkaProducer = null
const getProducer = async () => {
  if (!kafkaProducer) {
    const { publish } = await createProducer()
    kafkaProducer = publish
  }
  return kafkaProducer
}

const createPaymentIntent = async ({ orderId, userId, amount, currency = 'usd', metadata = {} }) => {
  // Check if payment already exists for this order
  const existing = await pool.query(
    `SELECT * FROM payments 
     WHERE order_id = $1 AND status NOT IN ('failed','cancelled')`,
    [orderId]
  )

  if (existing.rows.length > 0) {
    // Return existing payment intent instead of creating duplicate
    const payment = existing.rows[0]
    const intent = await stripe.paymentIntents.retrieve(
      payment.stripe_payment_intent_id
    )
    return { payment, clientSecret: intent.client_secret }
  }

  // Create Payment Intent on Stripe
  // Amount must be in smallest currency unit (cents for USD)
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),   // $999 → 99900 cents
    currency,
    metadata: {
      orderId,
      userId,
      ...metadata
    },
    automatic_payment_methods: { enabled: true }
  })

  // Store payment record
  const result = await pool.query(
    `INSERT INTO payments
       (order_id, user_id, stripe_payment_intent_id, amount, currency, status, metadata)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     RETURNING *`,
    [orderId, userId, intent.id, amount, currency, JSON.stringify(metadata)]
  )

  logger.info(`Payment intent created: ${intent.id} for order ${orderId}`)

  // Publish payment initiated event
  try {
    const publish = await getProducer()
    await publish(
      TOPICS.ORDER_EVENTS,
      EVENT_TYPES.PAYMENT_INITIATED,
      { orderId, userId, amount, paymentIntentId: intent.id },
      orderId
    )
  } catch (err) {
    logger.error('Failed to publish payment.initiated:', err.message)
  }

  return {
    payment: result.rows[0],
    clientSecret: intent.client_secret   // sent to frontend to complete payment
  }
}

const getPaymentByOrder = async (orderId) => {
  const result = await pool.query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [orderId]
  )
  if (result.rows.length === 0) {
    throw new AppError('Payment not found', 404)
  }
  return result.rows[0]
}

const processRefund = async (orderId, amount) => {
  const payment = await getPaymentByOrder(orderId)

  if (payment.status !== 'succeeded') {
    throw new AppError('Can only refund succeeded payments', 400)
  }

  // Create refund on Stripe
  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: amount ? Math.round(amount * 100) : undefined  // partial or full
  })

  const isPartial = amount && amount < payment.amount
  const newStatus = isPartial ? 'partially_refunded' : 'refunded'

  await pool.query(
    `UPDATE payments
     SET status = $1, refund_id = $2, refunded_amount = $3, updated_at = NOW()
     WHERE order_id = $4`,
    [newStatus, refund.id, amount || payment.amount, orderId]
  )

  // Publish refund event
  try {
    const publish = await getProducer()
    await publish(
      TOPICS.ORDER_EVENTS,
      EVENT_TYPES.PAYMENT_REFUNDED,
      { orderId, refundId: refund.id, amount: amount || payment.amount },
      orderId
    )
  } catch (err) {
    logger.error('Failed to publish payment.refunded:', err.message)
  }

  logger.info(`Refund processed: ${refund.id} for order ${orderId}`)
  return refund
}

// ─── WEBHOOK HANDLER ──────────────────────────────────────────────
// This is called by Stripe when payment events happen
const handleWebhook = async (rawBody, signature) => {
  let event

  // Verify the webhook is genuinely from Stripe
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message)
    throw new AppError('Invalid webhook signature', 400)
  }

  // Idempotency — have we already processed this exact event?
  const existing = await pool.query(
    'SELECT id FROM webhook_events WHERE stripe_event_id = $1',
    [event.id]
  )

  if (existing.rows.length > 0) {
    logger.info(`Duplicate webhook ignored: ${event.id}`)
    return { received: true, duplicate: true }
  }

  // Record event immediately before processing
  // This prevents duplicate processing even if handler crashes midway
  await pool.query(
    `INSERT INTO webhook_events (stripe_event_id, event_type, payload)
     VALUES ($1, $2, $3)`,
    [event.id, event.type, JSON.stringify(event.data)]
  )

  // Route to correct handler based on event type
  const publish = await getProducer()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object
      const { orderId, userId } = intent.metadata

      // Update payment record
      await pool.query(
        `UPDATE payments
         SET status = 'succeeded', updated_at = NOW()
         WHERE stripe_payment_intent_id = $1`,
        [intent.id]
      )

      // Publish to Kafka — Order Service will confirm the order
      await publish(
        TOPICS.ORDER_EVENTS,
        EVENT_TYPES.PAYMENT_SUCCEEDED,
        {
          orderId,
          userId,
          paymentIntentId: intent.id,
          amount: intent.amount / 100   // convert back from cents
        },
        orderId
      )

      // Trigger notification
      await publish(
        TOPICS.NOTIFICATION_EVENTS,
        EVENT_TYPES.NOTIFY_EMAIL,
        {
          to: intent.metadata.userEmail,
          template: 'payment_succeeded',
          data: { orderId, amount: intent.amount / 100 }
        }
      )

      logger.info(`Payment succeeded: ${intent.id} for order ${orderId}`)
      break
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object
      const { orderId, userId } = intent.metadata
      const reason = intent.last_payment_error?.message || 'Unknown error'

      await pool.query(
        `UPDATE payments
         SET status = 'failed', failure_reason = $1, updated_at = NOW()
         WHERE stripe_payment_intent_id = $2`,
        [reason, intent.id]
      )

      // Publish failure — Order Service will cancel, Inventory will release
      await publish(
        TOPICS.ORDER_EVENTS,
        EVENT_TYPES.PAYMENT_FAILED,
        { orderId, userId, paymentIntentId: intent.id, reason },
        orderId
      )

      // Notify user of failure
      await publish(
        TOPICS.NOTIFICATION_EVENTS,
        EVENT_TYPES.NOTIFY_EMAIL,
        {
          template: 'payment_failed',
          data: { orderId, reason }
        }
      )

      logger.warn(`Payment failed: ${intent.id} for order ${orderId} — ${reason}`)
      break
    }

    case 'charge.refunded': {
      logger.info(`Charge refunded: ${event.data.object.id}`)
      break
    }

    default:
      logger.info(`Unhandled webhook event: ${event.type}`)
  }

  // Mark webhook as processed
  await pool.query(
    'UPDATE webhook_events SET processed = true WHERE stripe_event_id = $1',
    [event.id]
  )

  return { received: true }
}

module.exports = {
  createPaymentIntent,
  getPaymentByOrder,
  processRefund,
  handleWebhook
}