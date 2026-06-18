const { withCorrelationId } = require('./logger')
const { v4: uuidv4 } = require('uuid')

const correlationMiddleware = (req, res, next) => {
  // Use existing correlation ID from gateway or generate new one
  const correlationId = req.headers['x-correlation-id'] || uuidv4()

  // Set on response so client can trace their request
  res.setHeader('X-Correlation-ID', correlationId)

  // Bind to async context — available in all downstream code
  withCorrelationId(correlationId, () => {
    req.correlationId = correlationId
    next()
  })
}

module.exports = correlationMiddleware