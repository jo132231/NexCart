const express = require('express')
const { body } = require('express-validator')
const router = express.Router()
const {
  createOrder, getOrders, getOrderById,
  cancelOrder, updateStatus
} = require('../controllers/order.controller')
const { protect, restrictTo } = require('../middleware/auth')

// All order routes require authentication
router.use(protect)

const orderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Items required'),
  body('items.*.productId').notEmpty().withMessage('Product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity required'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('shippingAddress').notEmpty().withMessage('Shipping address required'),
  body('shippingAddress.street').notEmpty(),
  body('shippingAddress.city').notEmpty(),
  body('shippingAddress.country').notEmpty()
]

router.post('/', orderValidation, createOrder)
router.get('/', getOrders)
router.get('/:id', getOrderById)
router.put('/:id/cancel', cancelOrder)

// Admin only
router.put('/:id/status', restrictTo('admin'), updateStatus)

module.exports = router