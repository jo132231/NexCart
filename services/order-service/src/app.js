const { initTracing } = require('../../../shared/tracing')
initTracing('order-service')
require('dotenv').config({ path: '../../shared/.env' })
const correlationMiddleware = require('../../../shared/correlationMiddleware')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const { logger } = require('../../../shared/logger')
const { initDB } = require('./config/db')
const initKafka = require('../../../shared/initKafka')
const { startSagaConsumer } = require('./services/saga.service')
const orderRoutes = require('./routes/order.routes')
const app = express()
const PORT = process.env.ORDER_SERVICE_PORT || 3005

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(correlationMiddleware)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date() })
})
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
app.use('/orders', orderRoutes)
app.use(errorHandler)

const start = async () => {
  await initDB()
  await initKafka()

  // Start saga consumer — reacts to payment and inventory events
  startSagaConsumer().catch(err => {
    logger.error('Saga consumer failed:', err.message)
  })

  app.listen(PORT, () => {
    logger.info(`Order service running on port ${PORT}`)
  })
}

start()