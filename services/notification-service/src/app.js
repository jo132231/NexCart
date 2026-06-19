const { initTracing } = require('../../../shared/tracing')
initTracing('notification-service')
require('dotenv').config({ path: '../../shared/.env' })
const correlationMiddleware = require('../../../shared/correlationMiddleware')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const { logger } = require('../../../shared/logger')
const { initDB } = require('./config/db')
const { pool } = require('./config/db')
const initKafka = require('../../../shared/initKafka')
const { startConsumer } = require('./services/consumer.service')
const notificationRoutes = require('./routes/notification.routes')

const app = express()
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3008

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(correlationMiddleware)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date() })
})
app.get('/ready', async (req, res) => {
  const checks = {}

  try {
    await pool.query('SELECT 1')
    checks.postgres = 'ok'
  } catch (err) {
    checks.postgres = 'error'
  }

  const allHealthy =
    Object.values(checks).every(v => v === 'ok')

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date()
  })
})
app.use('/notifications', notificationRoutes)
app.use(errorHandler)

const start = async () => {
  await initDB()
  await initKafka()

  startConsumer().catch(err => {
    logger.error('Notification consumer failed:', err.message)
  })

  app.listen(PORT, () => {
    logger.info(`Notification service running on port ${PORT}`)
  })
}

start()