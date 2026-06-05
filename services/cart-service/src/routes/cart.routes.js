const express = require('express')
const router = express.Router()
const {
  getCart, addItem, updateItem,
  removeItem, clearCart, mergeCarts
} = require('../controllers/cart.controller')
const { protect, optionalAuth } = require('../middleware/auth')

// Guest + user routes — optionalAuth means both can use these
router.get('/', optionalAuth, getCart)
router.post('/items', optionalAuth, addItem)
router.put('/items/:itemId', optionalAuth, updateItem)
router.delete('/items/:itemId', optionalAuth, removeItem)
router.delete('/', optionalAuth, clearCart)

// Logged in users only — merges guest cart on login
router.post('/merge', protect, mergeCarts)

module.exports = router