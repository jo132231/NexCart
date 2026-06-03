require('dotenv').config({ path: '../../shared/.env' })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { errorHandler } = require('../../../shared/errorHandler')
const logger = require('../../../shared/logger')
const { initDB } = require('./config/db')
const authRoutes = require('./routes/auth.routes')

require('dotenv').config({ path: '../../shared/.env' })
console.log('JWT_SECRET loaded:', !!process.env.JWT_SECRET)

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../shared/.env"),
  override: true
});


const app = express()
const PORT = process.env.USER_SERVICE_PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Health check — Kubernetes needs this
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service', timestamp: new Date() })
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