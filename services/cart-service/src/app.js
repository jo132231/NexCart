const { initTracing } = require('../../../shared/tracing')
initTracing('cart-service')
const path = require('path')
require('dotenv').config({
  path: path.resolve(__dirname, '../../../shared/.env')
})
const correlationMiddleware = require('../../shared/correlationMiddleware')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const { logger } = require('../../../../shared/logger')
const cartRoutes = require('./routes/cart.routes')
const redis = require('./config/redis')
app.get('/ready', async (req, res) => {
  const checks = {}

  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  const allHealthy =
    Object.values(checks).every(v => v === 'ok')

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date()
  })
})

const app = express()
const PORT = process.env.CART_SERVICE_PORT || 3003

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(correlationMiddleware)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cart-service', timestamp: new Date() })
})

app.use('/cart', cartRoutes)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Cart service running on port ${PORT}`)
})