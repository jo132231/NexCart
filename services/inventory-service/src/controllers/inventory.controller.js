const inventoryService = require('../services/inventory.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

const getStock = async (req, res, next) => {
  try {
    const stock = await inventoryService.getStock(req.params.productId)
    sendSuccess(res, stock, 'Stock fetched')
  } catch (err) { next(err) }
}

const updateStock = async (req, res, next) => {
  try {
    const stock = await inventoryService.updateStock(
      req.params.productId,
      req.body
    )
    sendSuccess(res, stock, 'Stock updated')
  } catch (err) { next(err) }
}

const reserveStock = async (req, res, next) => {
  try {
    const result = await inventoryService.reserveStock(req.body)
    sendSuccess(res, result, 'Stock reserved', 201)
  } catch (err) { next(err) }
}

const releaseStock = async (req, res, next) => {
  try {
    const result = await inventoryService.releaseStock(req.body)
    sendSuccess(res, result, 'Stock released')
  } catch (err) { next(err) }
}

module.exports = { getStock, updateStock, reserveStock, releaseStock }