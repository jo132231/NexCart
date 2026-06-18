const { createLogger, format, transports } = require('winston')
const { AsyncLocalStorage } = require('async_hooks')

// AsyncLocalStorage stores the correlation ID for the current async context
// This means you don't have to pass it manually through every function
const asyncLocalStorage = new AsyncLocalStorage()

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
    // Add correlation ID to every log line automatically
    format((info) => {
      const store = asyncLocalStorage.getStore()
      if (store?.correlationId) {
        info.correlationId = store.correlationId
      }
      return info
    })()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'nexcart',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, correlationId, service, ...meta }) => {
          const cid = correlationId ? `[${correlationId.slice(0, 8)}]` : ''
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : ''
          return `${timestamp} ${level} [${service}]${cid}: ${message}${metaStr}`
        })
      )
    })
  ]
})

// Run a function with a correlation ID bound to its async context
const withCorrelationId = (correlationId, fn) => {
  return asyncLocalStorage.run({ correlationId }, fn)
}

// Get current correlation ID from async context
const getCorrelationId = () => {
  return asyncLocalStorage.getStore()?.correlationId
}

module.exports = { logger, withCorrelationId, getCorrelationId }






// const { createLogger, format, transports } = require('winston')

// const logger = createLogger({
//   level: process.env.LOG_LEVEL || 'info',
//   format: format.combine(
//     format.timestamp(),
//     format.errors({ stack: true }),
//     format.json()
//   ),
//   defaultMeta: { service: process.env.SERVICE_NAME || 'nexcart' },
//   transports: [
//     new transports.Console({
//       format: format.combine(
//         format.colorize(),
//         format.simple()
//       )
//     })
//   ]
// })

// module.exports = logger


