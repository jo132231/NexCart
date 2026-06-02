const authService = require('../services/auth.service')
const { sendSuccess } = require('../../../../shared/responseHelper')
const { validationResult } = require('express-validator')
const { AppError } = require('../../../../shared/errorHandler')

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Invalid input data', 400)
    }
    const { user, accessToken, refreshToken } = await authService.register(req.body)
    sendSuccess(res, { user, accessToken, refreshToken }, 'Registration successful', 201)
  } catch (err) {
    next(err)
  }
}

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
      return next(
        new AppError(errors.array()[0].msg, 400)
      )
    }
    const { user, accessToken, refreshToken } = await authService.login(req.body)
    sendSuccess(res, { user, accessToken, refreshToken }, 'Login successful')
  } catch (err) {
    next(err)
  }
}

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    const tokens = await authService.refreshAccessToken(refreshToken)
    sendSuccess(res, tokens, 'Token refreshed')
  } catch (err) {
    next(err)
  }
}

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    const accessToken = req.headers.authorization?.split(' ')[1]
    await authService.logout(refreshToken, accessToken)
    sendSuccess(res, null, 'Logged out successfully')
  } catch (err) {
    next(err)
  }
}

const getMe = async (req, res, next) => {
  try {
    const { pool } = require('../config/db')
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    )
    sendSuccess(res, result.rows[0], 'User fetched')
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, refresh, logout, getMe }