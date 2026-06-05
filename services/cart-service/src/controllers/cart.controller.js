const cartService = require('../services/cart.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

const getCart = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id']
    if (!userId) return res.status(400).json({ success: false, message: 'User or guest ID required' })
    const cart = await cartService.getCart(userId)
    sendSuccess(res, cart, 'Cart fetched')
  } catch (err) { next(err) }
}

const addItem = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id']
    if (!userId) return res.status(400).json({ success: false, message: 'User or guest ID required' })
    const cart = await cartService.addItem(userId, req.body)
    sendSuccess(res, cart, 'Item added to cart', 201)
  } catch (err) { next(err) }
}

const updateItem = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id']
    const { quantity } = req.body
    const cart = await cartService.updateItem(userId, req.params.itemId, quantity)
    sendSuccess(res, cart, 'Cart updated')
  } catch (err) { next(err) }
}

const removeItem = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id']
    const cart = await cartService.removeItem(userId, req.params.itemId)
    sendSuccess(res, cart, 'Item removed')
  } catch (err) { next(err) }
}

const clearCart = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id']
    const cart = await cartService.clearCart(userId)
    sendSuccess(res, cart, 'Cart cleared')
  } catch (err) { next(err) }
}

const mergeCarts = async (req, res, next) => {
  try {
    const userId = req.user.userId
    const { guestId } = req.body
    if (!guestId) return res.status(400).json({ success: false, message: 'Guest ID required' })
    const cart = await cartService.mergeCarts(guestId, userId)
    sendSuccess(res, cart, 'Carts merged successfully')
  } catch (err) { next(err) }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, mergeCarts }