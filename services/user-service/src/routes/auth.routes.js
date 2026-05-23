const express = require('express')
const rateLimit = require('express-rate-limit')
const { body } = require('express-validator')
const router = express.Router()
const { register, login, refresh, logout, getMe } = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth')

// Rate limiter — max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts, try again in 15 minutes' }
})

// Validation rules
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
]

const loginRules = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
]

router.post('/register', registerRules, register)
router.post('/login', loginLimiter, loginRules, login)
router.post('/refresh', refresh)
router.post('/logout', protect, logout)
router.get('/me', protect, getMe)

module.exports = router