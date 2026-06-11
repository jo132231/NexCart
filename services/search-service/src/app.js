require('dotenv').config({ path: '../../shared/.env' })
// require('dotenv').config({ path: '../../.env' })

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const { initIndex } = require('./config/elasticsearch')
const { createConsumer, TOPICS, EVENT_TYPES } = require('../../../shared/kafkaClient')
const searchService = require('./services/search.service')
const searchRoutes = require('./routes/search.routes')

const app = express()
const PORT = process.env.SEARCH_SERVICE_PORT || 3007

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'search-service',
    timestamp: new Date()
  })
})

app.use('/search', searchRoutes)
app.use(errorHandler)

// ─── KAFKA EVENT HANDLERS ──────────────────────────────────────────
const startKafkaConsumer = async () => {
  const handlers = {
    // When a product is created → index it in Elasticsearch
    [EVENT_TYPES.PRODUCT_CREATED]: async (event) => {
      logger.info(`Indexing new product: ${event.data.name}`)
      await searchService.indexProduct(event.data)
    },

    // When a product is updated → update the index
    [EVENT_TYPES.PRODUCT_UPDATED]: async (event) => {
      logger.info(`Updating product index: ${event.data.productId}`)
      await searchService.indexProduct(event.data)
    },

    // When a product is deleted → remove from index
    [EVENT_TYPES.PRODUCT_DELETED]: async (event) => {
      logger.info(`Removing product from index: ${event.data.productId}`)
      await searchService.deleteProduct(event.data.productId)
    }
  }

  await createConsumer(
    'search-service-group',
    [TOPICS.PRODUCT_EVENTS],
    handlers,
    { maxRetries: 3 }
  )

  logger.info('Search service Kafka consumer started')
}

// ─── STARTUP ───────────────────────────────────────────────────────
const start = async () => {
  await initIndex()

  // Start Kafka consumer without blocking the HTTP server
  startKafkaConsumer().catch(err => {
    logger.error('Kafka consumer failed:', err.message)
  })

  app.listen(PORT, () => {
    logger.info(`Search service running on port ${PORT}`)
  })
}

start()