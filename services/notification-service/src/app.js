require('dotenv').config({ path: '../../.env' })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const { initDB } = require('./config/db')
const initKafka = require('../../../shared/initKafka')
const { startConsumer } = require('./services/consumer.service')
const notificationRoutes = require('./routes/notification.routes')

const app = express()
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3008

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date() })
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