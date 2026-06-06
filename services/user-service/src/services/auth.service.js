const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../config/db')
const { AppError } = require('../../../../shared/errorHandler')
const logger = require('../../../../shared/logger')

// Redis client for token blacklisting
const Redis = require('ioredis')
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6399
})

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  )

  console.log(process.env.JWT_SECRET)
  console.log(process.env.JWT_REFRESH_SECRET)

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  )

  return { accessToken, refreshToken }
}

const register = async ({ name, email, password }) => {
  // Check if user already exists
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  )
  if (existing.rows.length > 0) {
    throw new AppError('Email already registered', 409)
  }

  // Hash password — never store plain text
  const hashedPassword = await bcrypt.hash(password, 12)

  // Insert user
  const result = await pool.query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, created_at`,
    [name, email, hashedPassword]
  )

  const user = result.rows[0]
  const { accessToken, refreshToken } = generateTokens(user.id, user.role)

  // Store refresh token in DB
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [user.id, refreshToken]
  )

  logger.info(`New user registered: ${email}`)

  return { user, accessToken, refreshToken }
}

const login = async ({ email, password }) => {
  // Find user
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  )

  if (result.rows.length === 0) {
    // Same error for wrong email or wrong password
    // Never tell attackers which one is wrong
    throw new AppError('Invalid credentials', 401)
  }

  const user = result.rows[0]

  // Verify password
  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    throw new AppError('Invalid credentials', 401)
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.role)

  // Store refresh token
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [user.id, refreshToken]
  )

  logger.info(`User logged in: ${email}`)

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    accessToken,
    refreshToken
  }
}

const refreshAccessToken = async (refreshToken) => {
  // Check if token is blacklisted in Redis
  const isBlacklisted = await redis.get(`blacklist:${refreshToken}`)
  if (isBlacklisted) {
    throw new AppError('Token has been revoked', 401)
  }

  // Verify token
  let decoded
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch {
    throw new AppError('Invalid refresh token', 401)
  }

  // Check token exists in DB
  const result = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE user_id = $1 AND token = $2 AND expires_at > NOW()`,
    [decoded.userId, refreshToken]
  )

  if (result.rows.length === 0) {
    throw new AppError('Refresh token expired or not found', 401)
  }

  // Get user
  const userResult = await pool.query(
    'SELECT id, role FROM users WHERE id = $1',
    [decoded.userId]
  )

  const user = userResult.rows[0]
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role)

  // Rotate refresh token — old one deleted, new one stored
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken])
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [user.id, newRefreshToken]
  )

  return { accessToken, refreshToken: newRefreshToken }
}

const logout = async (refreshToken, accessToken) => {
  // Blacklist the access token in Redis until it expires
  const decoded = jwt.decode(accessToken)
  const ttl = decoded.exp - Math.floor(Date.now() / 1000)
  if (ttl > 0) {
    await redis.setex(`blacklist:${accessToken}`, ttl, 'true')
  }

  // Remove refresh token from DB
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken])

  logger.info(`User logged out: ${decoded.userId}`)
}

module.exports = { register, login, refreshAccessToken, logout }   