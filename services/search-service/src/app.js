require('dotenv').config({ path: '../../.env' })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const { initIndex } = require('./config/elasticsearch')
const searchRoutes = require('./routes/search.routes')

const app = express()
const PORT = process.env.SEARCH_SERVICE_PORT || 3007

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'search-service', timestamp: new Date() })
})

app.use('/search', searchRoutes)
app.use(errorHandler)

const start = async () => {
  await initIndex()
  app.listen(PORT, () => {
    logger.info(`Search service running on port ${PORT}`)
  })
}

start()