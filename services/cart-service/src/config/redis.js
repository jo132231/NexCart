const Redis = require('ioredis')
const { logger } = require('../../../../shared/logger')

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6399,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries')
      return null
    }
    return times * 500
  }
})

redis.on('connect', () => logger.info('Redis connected successfully'))
redis.on('error', (err) => logger.error('Redis error:', err.message))

module.exports = redis