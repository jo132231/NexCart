const path = require('path')
const { initTracing } = require('../../../shared/tracing')
initTracing('user-service')

require('dotenv').config({
  path: path.resolve(__dirname, '../../shared/.env'),
  override: true
})

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const { logger } = require('../../../shared/logger')
const correlationMiddleware = require('../../../shared/correlationMiddleware')
const { initDB, pool } = require('./config/db')
const authRoutes = require('./routes/auth.routes')

const app = express()
const PORT = process.env.USER_SERVICE_PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(correlationMiddleware)

// Liveness probe — is the process alive?
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'user-service',
    timestamp: new Date(),
    uptime: process.uptime()
  })
})

// Readiness probe — is the service ready for traffic?
app.get('/ready', async (req, res) => {
  const checks = {}

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

// Routes
app.use('/auth', authRoutes)

// Global error handler — must be last
app.use(errorHandler)

// Start server
const start = async () => {
  await initDB()
  app.listen(PORT, () => {
    logger.info(`User service running on port ${PORT}`)
  })
}

start()