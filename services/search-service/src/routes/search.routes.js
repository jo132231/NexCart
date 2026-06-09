const express = require('express')
const router = express.Router()
const {
  search, autocomplete, getFilters, indexProduct, bulkIndex
} = require('../controllers/search.controller')
const { protect, restrictTo } = require('../middleware/auth')

// Public search endpoints
router.get('/', search)
router.get('/autocomplete', autocomplete)
router.get('/filters', getFilters)

// Internal — for indexing products (called by product service or admin)
router.post('/index', protect, restrictTo('admin'), indexProduct)
router.post('/bulk-index', protect, restrictTo('admin'), bulkIndex)

module.exports = router