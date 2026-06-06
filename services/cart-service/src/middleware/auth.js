const jwt = require('jsonwebtoken')
const Redis = require('ioredis')
const { AppError } = require('../../../../shared/errorHandler')
const { URL } = require('url')
const http = require('http')
const https = require('https')

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6399
})

const getRefreshTokenFromRequest = (req) => {
  return req.headers['x-refresh-token'] || req.headers['refresh-token'] || req.body?.refreshToken || req.query?.refreshToken || null
}

// Helper: exchange refresh token at user-service for new access token
const refreshWithUserService = (refreshToken) => {
  return new Promise((resolve, reject) => {
    if (!refreshToken) return resolve(null)
    const userServiceUrl = process.env.USER_SERVICE_URL || `http://localhost:${process.env.USER_SERVICE_PORT || 3001}`
    const url = new URL('/auth/refresh', userServiceUrl)
    const data = JSON.stringify({ refreshToken })
    const lib = url.protocol === 'https:' ? https : http
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }
    const req = lib.request(opts, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          // expected { success, data: { accessToken, refreshToken } }
          const accessToken = parsed?.data?.accessToken || parsed?.accessToken || null
          resolve(accessToken)
        } catch (e) {
          resolve(null)
        }
      })
    })
    req.on('error', (e) => reject(e))
    req.write(data)
    req.end()
  })
}

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader) : undefined
    if (!token) throw new AppError('No token provided', 401)
    const isBlacklisted = await redis.get(`blacklist:${token}`)
    if (isBlacklisted) throw new AppError('Token revoked', 401)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      userId: decoded.id || decoded.userId || decoded.uid || decoded.sub,
      role: decoded.role
    }
    return next()
  } catch (err) {
    next(err)
  }
}

// Optional auth — doesn't fail if no token, used for guest support
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader) : undefined
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = {
        userId: decoded.id || decoded.userId || decoded.uid || decoded.sub,
        role: decoded.role
      }
    }
    next()
  } catch(err) {
    if (err && err.name === 'TokenExpiredError') {
      const authHeader = req.headers.authorization
      const rawToken = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader) : undefined
      // Try to refresh using refresh token from several request locations
      try {
        const refreshToken = getRefreshTokenFromRequest(req)
        if (refreshToken) {
          const newAccess = await refreshWithUserService(refreshToken)
          if (newAccess) {
            try {
              const decodedNew = jwt.verify(newAccess, process.env.JWT_SECRET)
              req.user = {
                userId: decodedNew.id || decodedNew.userId || decodedNew.uid || decodedNew.sub,
                role: decodedNew.role
              }
              // Inform caller of new access token
              res.setHeader('x-access-token', newAccess)
              return next()
            } catch (vErr) {
              console.error('optionalAuth verify refreshed token failed', vErr)
            }
          }
        }
      } catch (rErr) {
        console.error('optionalAuth refresh error', rErr)
      }

      if (rawToken) {
        try {
          const decodedExpired = jwt.decode(rawToken)
          if (decodedExpired) {
            req.user = {
              userId: decodedExpired.id || decodedExpired.userId || decodedExpired.uid || decodedExpired.sub,
              role: decodedExpired.role
            }
          }
        } catch (_) {
          // ignore expired token decode errors
        }
      }

      return next()
    }
    if (req.headers.authorization) {
      return next(err)
    }
    return next()
  }
}

module.exports = { protect, optionalAuth }