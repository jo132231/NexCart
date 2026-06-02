require('dotenv').config({ path: '../../.env' })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const connectDB = require('./config/db')
const initStorage = require('./config/initStorage')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const productRoutes = require('./routes/product.routes')

const app = express()
const PORT = process.env.PRODUCT_SERVICE_PORT || 3002

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service', timestamp: new Date() })
})

app.use('/products', productRoutes)
app.use(errorHandler)

const start = async () => {
  await connectDB()
  await initStorage()
  app.listen(PORT, () => {
    logger.info(`Product service running on port ${PORT}`)
  })
}

start()