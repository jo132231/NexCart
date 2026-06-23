const { createConsumer, TOPICS, EVENT_TYPES } = require('../../../../shared/kafkaClient')
const { sendEmail, sendInApp } = require('./notification.service')
const { logger } = require('../../../../shared/logger')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nexcart.com'

const startConsumer = async () => {
  const handlers = {

    // ─── ORDER EVENTS ───────────────────────────────────────────
    [EVENT_TYPES.ORDER_PLACED]: async (event) => {
      const { orderId, userId, items, total } = event.data
      logger.info(`Sending order confirmation for: ${orderId}`)

      await sendInApp({
        userId,
        type: 'order_placed',
        content: `Your order #${orderId.slice(-8).toUpperCase()} has been placed successfully`,
        metadata: { orderId, total }
      })
    },

    [EVENT_TYPES.ORDER_CONFIRMED]: async (event) => {
      const { orderId, userId } = event.data

      await sendInApp({
        userId,
        type: 'order_confirmed',
        content: `Order #${orderId.slice(-8).toUpperCase()} confirmed — payment received`,
        metadata: { orderId }
      })
    },

    [EVENT_TYPES.ORDER_SHIPPED]: async (event) => {
      const { orderId, userId, trackingNumber } = event.data

      await sendInApp({
        userId,
        type: 'order_shipped',
        content: `Order #${orderId.slice(-8).toUpperCase()} has been shipped!`,
        metadata: { orderId, trackingNumber }
      })
    },

    [EVENT_TYPES.ORDER_CANCELLED]: async (event) => {
      const { orderId, userId, reason } = event.data

      await sendInApp({
        userId,
        type: 'order_cancelled',
        content: `Order #${orderId.slice(-8).toUpperCase()} was cancelled. ${reason || ''}`,
        metadata: { orderId, reason }
      })
    },

    // ─── PAYMENT EVENTS ─────────────────────────────────────────
    [EVENT_TYPES.PAYMENT_SUCCEEDED]: async (event) => {
      const { orderId, userId, amount } = event.data

      // Send email receipt
      if (event.data.userEmail) {
        await sendEmail({
          to: event.data.userEmail,
          template: 'payment_succeeded',
          data: { orderId, amount, userId }
        })
      }

      await sendInApp({
        userId,
        type: 'payment_succeeded',
        content: `Payment of $${amount} received for order #${orderId.slice(-8).toUpperCase()}`,
        metadata: { orderId, amount }
      })
    },

    [EVENT_TYPES.PAYMENT_FAILED]: async (event) => {
      const { orderId, userId, reason } = event.data

      if (event.data.userEmail) {
        await sendEmail({
          to: event.data.userEmail,
          template: 'payment_failed',
          data: { orderId, reason, userId }
        })
      }

      await sendInApp({
        userId,
        type: 'payment_failed',
        content: `Payment failed for order #${orderId.slice(-8).toUpperCase()}. ${reason}`,
        metadata: { orderId, reason }
      })
    },

    // ─── INVENTORY EVENTS ────────────────────────────────────────
    [EVENT_TYPES.STOCK_LOW]: async (event) => {
      const { productId, productName, available, threshold } = event.data

      // Low stock alerts go to admin only
      await sendEmail({
        to: ADMIN_EMAIL,
        template: 'low_stock_alert',
        data: { productId, productName, available, threshold }
      })

      logger.warn(`Low stock alert sent for: ${productName}`)
    },

    // ─── DIRECT NOTIFICATION EVENTS ──────────────────────────────
    [EVENT_TYPES.NOTIFY_EMAIL]: async (event) => {
      const { to, template, data, subject, html } = event.data
      if (!to) return
      await sendEmail({ to, template, data, subject, html })
    },

    [EVENT_TYPES.NOTIFY_PUSH]: async (event) => {
      // Placeholder for future push notification integration
      logger.info(`Push notification queued for: ${event.data.userId}`)
    }
  }

  await createConsumer(
    'notification-service-group',
    [
      TOPICS.ORDER_EVENTS,
      TOPICS.INVENTORY_EVENTS,
      TOPICS.NOTIFICATION_EVENTS
    ],
    handlers,
    { maxRetries: 3 }
  )

  logger.info('Notification consumer started — listening to all event topics')
}

module.exports = { startConsumer }