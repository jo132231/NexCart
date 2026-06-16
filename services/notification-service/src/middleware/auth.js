const jwt = require('jsonwebtoken')
const { AppError } = require('../../../../shared/errorHandler')

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) throw new AppError('No token provided', 401)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) { next(err) }
}

module.exports = { protect }