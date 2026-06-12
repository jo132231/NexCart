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

// Valid state transitions — the state machine rules
const VALID_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered'],
  delivered:  [],
  cancelled:  [],
  refunded:   []
}

const createOrder = async (userId, orderData) => {
  const {
    items,
    shippingAddress,
    idempotencyKey,
    notes
  } = orderData

  // Idempotency check — has this exact request been made before?
  if (idempotencyKey) {
    const existing = await pool.query(
      'SELECT * FROM orders WHERE idempotency_key = $1',
      [idempotencyKey]
    )
    if (existing.rows.length > 0) {
      logger.info(`Idempotent request — returning existing order: ${idempotencyKey}`)
      return existing.rows[0]   // return existing instead of creating duplicate
    }
  }

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + (item.price * item.quantity), 0
  )
  const tax = Math.round(subtotal * 0.1 * 100) / 100   // 10% tax
  const shippingFee = subtotal > 100 ? 0 : 9.99         // free shipping over $100
  const total = Math.round((subtotal + tax + shippingFee) * 100) / 100

  // Create order in database
  const result = await pool.query(
    `INSERT INTO orders 
       (user_id, idempotency_key, items, shipping_address, 
        subtotal, tax, shipping_fee, total, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      idempotencyKey || null,
      JSON.stringify(items),
      JSON.stringify(shippingAddress),
      subtotal,
      tax,
      shippingFee,
      total,
      notes || null
    ]
  )

  const order = result.rows[0]

  // Record the event in audit log
  await recordEvent(order.id, 'order.created', { userId, total })

  // Publish to Kafka — Inventory Service will consume this
  try {
    const publish = await getProducer()
    await publish(
      TOPICS.ORDER_EVENTS,
      EVENT_TYPES.ORDER_PLACED,
      {
        orderId: order.id,
        userId,
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        total,
        shippingAddress
      },
      order.id   // partition key — all events for same order go to same partition
    )
  } catch (err) {
    logger.error('Failed to publish order.placed event:', err.message)
  }

  logger.info(`Order created: ${order.id} for user ${userId}`)
  return order
}

const getOrders = async (userId, { page = 1, limit = 10, status }) => {
  const offset = (page - 1) * limit
  const filter = status
    ? 'WHERE user_id = $1 AND status = $2'
    : 'WHERE user_id = $1'
  const params = status ? [userId, status] : [userId]

  const [orders, count] = await Promise.all([
    pool.query(
      `SELECT * FROM orders ${filter} 
       ORDER BY created_at DESC 
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM orders ${filter}`,
      params
    )
  ])

  return {
    orders: orders.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: parseInt(count.rows[0].count),
      pages: Math.ceil(parseInt(count.rows[0].count) / limit)
    }
  }
}

const getOrderById = async (orderId, userId) => {
  const result = await pool.query(
    `SELECT o.*, 
       json_agg(oe ORDER BY oe.created_at) as event_history
     FROM orders o
     LEFT JOIN order_events oe ON oe.order_id = o.id
     WHERE o.id = $1 AND o.user_id = $2
     GROUP BY o.id`,
    [orderId, userId]
  )

  if (result.rows.length === 0) {
    throw new AppError('Order not found', 404)
  }

  return result.rows[0]
}

const updateOrderStatus = async (orderId, newStatus, metadata = {}) => {
  // Get current order
  const current = await pool.query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId]
  )

  if (current.rows.length === 0) {
    throw new AppError('Order not found', 404)
  }

  const order = current.rows[0]
  const currentStatus = order.status

  // Enforce state machine — only allow valid transitions
  if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
    throw new AppError(
      `Invalid transition: ${currentStatus} → ${newStatus}`,
      400
    )
  }

  // Update order status
  const updated = await pool.query(
    `UPDATE orders 
     SET status = $1,
         payment_intent_id = COALESCE($2, payment_intent_id),
         cancelled_reason = COALESCE($3, cancelled_reason),
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [newStatus, metadata.paymentIntentId || null, metadata.reason || null, orderId]
  )

  // Record in audit log
  await recordEvent(orderId, `order.${newStatus}`, metadata)

  // Publish status change event to Kafka
  try {
    const publish = await getProducer()
    const eventType = EVENT_TYPES[`ORDER_${newStatus.toUpperCase()}`]
    if (eventType) {
      await publish(
        TOPICS.ORDER_EVENTS,
        eventType,
        { orderId, previousStatus: currentStatus, newStatus, ...metadata },
        orderId
      )
    }
  } catch (err) {
    logger.error('Failed to publish order status event:', err.message)
  }

  logger.info(`Order ${orderId}: ${currentStatus} → ${newStatus}`)
  return updated.rows[0]
}

const cancelOrder = async (orderId, userId, reason) => {
  const result = await pool.query(
    'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId]
  )

  if (result.rows.length === 0) {
    throw new AppError('Order not found', 404)
  }

  const order = result.rows[0]

  // Only pending or confirmed orders can be cancelled by users
  if (!['pending', 'confirmed'].includes(order.status)) {
    throw new AppError(
      `Cannot cancel order in ${order.status} status`,
      400
    )
  }

  return updateOrderStatus(orderId, 'cancelled', { reason })
}

// Internal helper — records every event in audit log
const recordEvent = async (orderId, eventType, payload) => {
  await pool.query(
    `INSERT INTO order_events (order_id, event_type, payload)
     VALUES ($1, $2, $3)`,
    [orderId, eventType, JSON.stringify(payload)]
  )
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder
}