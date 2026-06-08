const jwt = require('jsonwebtoken')
const { AppError } = require('../../../../shared/errorHandler')
const { Pool } = require('pg')

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) throw new AppError('No token provided', 401)
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