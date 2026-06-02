const express = require('express')
const { body, query } = require('express-validator')
const router = express.Router()
const {
  createProduct, getProducts, getProductById,
  updateProduct, deleteProduct, getCategories
} = require('../controllers/product.controller')
const { protect, restrictTo } = require('../middleware/auth')
const { upload } = require('../config/storage')

// Public routes — anyone can browse
router.get('/', getProducts)
router.get('/categories', getCategories)
router.get('/:id', getProductById)

// Admin only routes — must be logged in AND have role=admin
router.post('/',
  protect,
  restrictTo('admin'),
  upload.array('images', 5),      // max 5 images
  createProduct
)

router.put('/:id',
  protect,
  restrictTo('admin'),
  upload.array('images', 5),
  updateProduct
)

router.delete('/:id',
  protect,
  restrictTo('admin'),
  deleteProduct
)

module.exports = router