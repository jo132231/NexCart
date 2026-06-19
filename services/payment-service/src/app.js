const { initTracing } = require('../../../shared/tracing')
initTracing('payment-service')
require('dotenv').config({ path: '../../shared/.env' })
const correlationMiddleware = require('../../../shared/correlationMiddleware')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const { logger } = require('../../../shared/logger')
const { initDB } = require('./config/db')
const initKafka = require('../../../shared/initKafka')
const paymentRoutes = require('./routes/payment.routes')
const app = express()
const PORT = process.env.PAYMENT_SERVICE_PORT || 3006

app.use(helmet())
app.use(cors())
app.use(correlationMiddleware)
// Important: webhook route needs raw body
// So we apply express.json() AFTER defining webhook route
// which is handled inside payment.routes.js per-route
app.use(express.json())
// Liveness probe — is the process alive?
// Health check is repeated in thE files PAYMENT, USER, INVENTORY and ORDER
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: process.env.SERVICE_NAME,
    timestamp: new Date(),
    uptime: process.uptime()
  })
})

// Readiness probe — is the service ready for traffic?
app.get('/ready', async (req, res) => {
  const checks = {}

  // Check PostgreSQL (for services that use it)
  try {
    await pool.query('SELECT 1')
    checks.postgres = 'ok'
  } catch {
    checks.postgres = 'error'
  }

  const allHealthy = Object.values(checks).every(v => v === 'ok')

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date()
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service', timestamp: new Date() })
})

app.use('/payments', paymentRoutes)
app.use(errorHandler)

const start = async () => {
  await initDB()
  await initKafka()
  app.listen(PORT, () => {
    logger.info(`Payment service running on port ${PORT}`)
  })
}

start()