const orderService = require('../services/order.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

const createOrder = async (req, res, next) => {
  try {
    // Idempotency key from header — standard REST pattern
    const idempotencyKey = req.headers['idempotency-key']
    const order = await orderService.createOrder(
      req.user.userId,
      { ...req.body, idempotencyKey }
    )
    sendSuccess(res, order, 'Order created', 201)
  } catch (err) { next(err) }
}

const getOrders = async (req, res, next) => {
  try {
    const result = await orderService.getOrders(req.user.userId, req.query)
    sendSuccess(res, result, 'Orders fetched')
  } catch (err) { next(err) }
}

const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(
      req.params.id,
      req.user.userId
    )
    sendSuccess(res, order, 'Order fetched')
  } catch (err) { next(err) }
}

const cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(
      req.params.id,
      req.user.userId,
      req.body.reason
    )
    sendSuccess(res, order, 'Order cancelled')
  } catch (err) { next(err) }
}

// Admin only — update any order status
const updateStatus = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      req.body.status,
      req.body
    )
    sendSuccess(res, order, 'Order status updated')
  } catch (err) { next(err) }
}

module.exports = { createOrder, getOrders, getOrderById, cancelOrder, updateStatus }