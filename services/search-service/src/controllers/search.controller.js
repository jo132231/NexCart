const searchService = require('../services/search.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

const search = async (req, res, next) => {
  try {
    const results = await searchService.searchProducts(req.query)
    sendSuccess(res, results, 'Search results fetched')
  } catch (err) { next(err) }
}

const autocomplete = async (req, res, next) => {
  try {
    const results = await searchService.autocomplete(req.query.q)
    sendSuccess(res, results, 'Autocomplete suggestions')
  } catch (err) { next(err) }
}

const getFilters = async (req, res, next) => {
  try {
    const filters = await searchService.getFilters()
    sendSuccess(res, filters, 'Filters fetched')
  } catch (err) { next(err) }
}

const indexProduct = async (req, res, next) => {
  try {
    await searchService.indexProduct(req.body)
    sendSuccess(res, null, 'Product indexed')
  } catch (err) { next(err) }
}

const bulkIndex = async (req, res, next) => {
  try {
    await searchService.bulkIndexProducts(req.body.products)
    sendSuccess(res, null, `${req.body.products.length} products indexed`)
  } catch (err) { next(err) }
}

module.exports = { search, autocomplete, getFilters, indexProduct, bulkIndex }