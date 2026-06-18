const { initTracing } = require('../../../shared/tracing')
initTracing('inventory-service')
require('dotenv').config({ path: '../../shared/.env' })
const correlationMiddleware = require('../../shared/correlationMiddleware')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const { logger } = require('../../../../shared/logger')
const { initDB } = require('./config/db')
const inventoryRoutes = require('./routes/inventory.routes')

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

const app = express()
const PORT = process.env.INVENTORY_SERVICE_PORT || 3004

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(correlationMiddleware)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date() })
})

app.use('/inventory', inventoryRoutes)
app.use(errorHandler)

const initKafka = require('../../../shared/initKafka')

const start = async () => {
  await initDB()
  await initKafka()

  app.listen(PORT, () => {
    logger.info(`Inventory service running on port ${PORT}`)
  })
}

start()