const express = require('express')
const router = express.Router()
const {
  getStock, updateStock, reserveStock, releaseStock
} = require('../controllers/inventory.controller')
const { protect, restrictTo } = require('../middleware/auth')

// Public — anyone can check stock
router.get('/:productId', getStock)

// Admin only — update stock levels
router.put('/:productId', protect, restrictTo('admin'), updateStock)

// Internal — called by order service during checkout
router.post('/reserve', protect, reserveStock)
router.post('/release', protect, releaseStock)

module.exports = router