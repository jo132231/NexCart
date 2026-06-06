const path = require('path')
require('dotenv').config({
  path: path.resolve(__dirname, '../../../shared/.env')
})
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const cartRoutes = require('./routes/cart.routes')

const app = express()
const PORT = process.env.CART_SERVICE_PORT || 3003

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cart-service', timestamp: new Date() })
})

app.use('/cart', cartRoutes)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Cart service running on port ${PORT}`)
})