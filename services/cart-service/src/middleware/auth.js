const jwt = require('jsonwebtoken')
const Redis = require('ioredis')
const { AppError } = require('../../../../shared/errorHandler')

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379
})

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) throw new AppError('No token provided', 401)
    const isBlacklisted = await redis.get(`blacklist:${token}`)
    if (isBlacklisted) throw new AppError('Token revoked', 401)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) { next(err) }
}

// Optional auth — doesn't fail if no token, used for guest support
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = decoded
    }
    next()
  } catch {
    next()  // silently continue even if token is invalid
  }
}

module.exports = { protect, optionalAuth }