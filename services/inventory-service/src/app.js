require('dotenv').config({ path: '../../shared/.env' })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const { initDB } = require('./config/db')
const inventoryRoutes = require('./routes/inventory.routes')

const app = express()
const PORT = process.env.INVENTORY_SERVICE_PORT || 3004

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date() })
})

app.use('/inventory', inventoryRoutes)
app.use(errorHandler)

const start = async () => {
  await initDB()
  app.listen(PORT, () => {
    logger.info(`Inventory service running on port ${PORT}`)
  })
}

start()