require('dotenv').config({ path: '../../shared/.env' })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const { initDB } = require('./config/db')
const initKafka = require('../../../shared/initKafka')
const paymentRoutes = require('./routes/payment.routes')

const app = express()
const PORT = process.env.PAYMENT_SERVICE_PORT || 3006

app.use(helmet())
app.use(cors())

// Important: webhook route needs raw body
// So we apply express.json() AFTER defining webhook route
// which is handled inside payment.routes.js per-route
app.use(express.json())

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