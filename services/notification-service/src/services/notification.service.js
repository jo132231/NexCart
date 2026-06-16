const sgMail = require('@sendgrid/mail')
const { pool } = require('../config/db')
const { getTemplate } = require('../templates')
const logger = require('../../../../shared/logger')

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'notifications@nexcart.com'

// ─── EMAIL ────────────────────────────────────────────────────────
const sendEmail = async ({ to, template, data, subject, html }) => {
  try {
    // Use template if provided, otherwise use raw subject/html
    const content = template
      ? getTemplate(template, data)
      : { subject, html }

    const msg = {
      to,
      from: {
        email: SENDER_EMAIL,
        name: 'NexCart'
      },
      subject: content.subject,
      html: content.html
    }

    await sgMail.send(msg)

    // Store in database for audit trail
    await storeNotification({
      userId: data?.userId,
      type: template || 'custom',
      channel: 'email',
      subject: content.subject,
      content: content.html,
      metadata: { to, template, data }
    })

    logger.info(`Email sent: ${template || 'custom'} → ${to}`)
    return { success: true }

  } catch (err) {
    logger.error(`Email failed: ${err.message}`)
    // Store failed notification for debugging
    await storeNotification({
      userId: data?.userId,
      type: template || 'custom',
      channel: 'email',
      subject: 'FAILED',
      content: err.message,
      metadata: { to, template, error: err.message },
      status: 'failed'
    })
    throw err
  }
}

// ─── IN-APP NOTIFICATIONS ─────────────────────────────────────────
const sendInApp = async ({ userId, type, content, metadata }) => {
  await storeNotification({
    userId,
    type,
    channel: 'in_app',
    subject: type,
    content,
    metadata
  })
  logger.info(`In-app notification stored for user: ${userId}`)
}

// ─── DATABASE STORAGE ─────────────────────────────────────────────
const storeNotification = async ({
  userId, type, channel, subject, content, metadata, status = 'sent'
}) => {
  await pool.query(
    `INSERT INTO notifications
       (user_id, type, channel, subject, content, metadata, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, type, channel, subject, content,
     JSON.stringify(metadata), status]
  )
}

const getUnreadNotifications = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = $1 AND channel = 'in_app' AND read = false
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  )
  return result.rows
}

const markAsRead = async (userId, notificationId) => {
  await pool.query(
    `UPDATE notifications SET read = true
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  )
}

module.exports = {
  sendEmail,
  sendInApp,
  getUnreadNotifications,
  markAsRead
}