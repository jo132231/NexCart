const jwt = require('jsonwebtoken')
const Redis = require('ioredis')
const { AppError } = require('../../../../shared/errorHandler')

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
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

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Not authorized', 403))
  }
  next()
}

module.exports = { protect, restrictTo }