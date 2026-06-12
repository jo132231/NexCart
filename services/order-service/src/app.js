require('dotenv').config({ path: '../../shared/.env' })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const { initDB } = require('./config/db')
const initKafka = require('../../../shared/initKafka')
const { startSagaConsumer } = require('./services/saga.service')
const orderRoutes = require('./routes/order.routes')

const app = express()
const PORT = process.env.ORDER_SERVICE_PORT || 3005

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date() })
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