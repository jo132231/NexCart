const express = require('express')
const router = express.Router()
const {
  createPaymentIntent, getPaymentStatus, refund, webhook
} = require('../controllers/payment.controller')
const { protect, restrictTo } = require('../middleware/auth')

// Webhook MUST use raw body — before express.json() parses it
// Stripe signature verification requires the exact raw bytes
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body   // save raw buffer
    next()
  },
  webhook
)

// Protected routes
router.use(protect)
router.post('/intent', createPaymentIntent)
router.get('/:orderId', getPaymentStatus)
router.post('/:orderId/refund', restrictTo('admin'), refund)

module.exports = router