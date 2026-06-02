const productService = require('../services/product.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

const createProduct = async (req, res, next) => {
  try {
    // Parse variants and tags if sent as JSON strings (multipart form)
    if (req.body.variants) req.body.variants = JSON.parse(req.body.variants)
    if (req.body.tags) req.body.tags = JSON.parse(req.body.tags)

    const product = await productService.createProduct(req.body, req.files)
    sendSuccess(res, product, 'Product created', 201)
  } catch (err) { next(err) }
}

const getProducts = async (req, res, next) => {
  try {
    const result = await productService.getProducts(req.query)
    sendSuccess(res, result, 'Products fetched')
  } catch (err) { next(err) }
}

const getProductById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id)
    sendSuccess(res, product, 'Product fetched')
  } catch (err) { next(err) }
}

const updateProduct = async (req, res, next) => {
  try {
    if (req.body.variants) req.body.variants = JSON.parse(req.body.variants)
    if (req.body.tags) req.body.tags = JSON.parse(req.body.tags)
    const product = await productService.updateProduct(req.params.id, req.body, req.files)
    sendSuccess(res, product, 'Product updated')
  } catch (err) { next(err) }
}

const deleteProduct = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.params.id)
    sendSuccess(res, null, 'Product deleted')
  } catch (err) { next(err) }
}

const getCategories = async (req, res, next) => {
  try {
    const categories = await productService.getCategories()
    sendSuccess(res, categories, 'Categories fetched')
  } catch (err) { next(err) }
}

module.exports = {
  createProduct, getProducts, getProductById,
  updateProduct, deleteProduct, getCategories
}