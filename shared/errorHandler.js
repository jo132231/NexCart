const logger = require('./logger')

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  })

  // JWT Invalid Token
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    })
  }

  // JWT Expired Token
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    })
  }

  const statusCode = err.statusCode || 500
  const message = err.message || 'Something went wrong'

  res.status(statusCode).json({
  success: false,
  message,
  debug: err.stack
})
}

class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = { errorHandler, AppError }