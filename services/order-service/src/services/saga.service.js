const { updateOrderStatus } = require('./order.service')
const { createConsumer, TOPICS, EVENT_TYPES } = require('../../../../shared/kafkaClient')
const logger = require('../../../../shared/logger')

// These are the compensating transaction handlers
// They run when something in the saga fails

const handlePaymentSucceeded = async (event) => {
  const { orderId, paymentIntentId } = event.data
  logger.info(`Payment succeeded for order: ${orderId}`)

  await updateOrderStatus(orderId, 'confirmed', { paymentIntentId })
}

const handlePaymentFailed = async (event) => {
  const { orderId, reason } = event.data
  logger.warn(`Payment failed for order: ${orderId} — ${reason}`)

  // Compensating transaction — cancel the order
  await updateOrderStatus(orderId, 'cancelled', {
    reason: `Payment failed: ${reason}`
  })

  // Note: Inventory Service handles releasing stock separately
  // by also consuming the payment.failed event
  // This is loose coupling — Order Service doesn't call Inventory directly
}

const handleStockReserved = async (event) => {
  const { orderId } = event.data
  logger.info(`Stock reserved for order: ${orderId} — ready for payment`)
  // Could trigger payment here in a more automated flow
  // For now we just log — payment is triggered by the client
}

const handleStockFailed = async (event) => {
  const { orderId, reason } = event.data
  logger.warn(`Stock reservation failed for order: ${orderId}`)

  await updateOrderStatus(orderId, 'cancelled', {
    reason: `Out of stock: ${reason}`
  })
}

const startSagaConsumer = async () => {
  const handlers = {
    [EVENT_TYPES.PAYMENT_SUCCEEDED]: handlePaymentSucceeded,
    [EVENT_TYPES.PAYMENT_FAILED]: handlePaymentFailed,
    [EVENT_TYPES.STOCK_RESERVED]: handleStockReserved,
  }

  await createConsumer(
    'order-service-saga-group',
    [TOPICS.INVENTORY_EVENTS, TOPICS.ORDER_EVENTS],
    handlers,
    { maxRetries: 3 }
  )

  logger.info('Order saga consumer started')
}

module.exports = { startSagaConsumer }