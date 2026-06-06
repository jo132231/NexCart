const cartService = require('../services/cart.service')
const { sendSuccess } = require('../../../../shared/responseHelper')

// console.log(req.user)
// console.log(req.headers) 

const getCart = async (req, res, next) => {
  try {
    console.log('GET /cart headers.authorization =', req.headers.authorization)
    console.log('GET /cart req.user =', req.user)
    const userId = req.user?.userId || req.user?.id || req.user?.uid || req.user?.sub || req.headers['x-guest-id']
    const guestId = req.headers['x-guest-id']

    if (!userId && !guestId)
      return res.status(400).json({ success: false, message: 'User or guest ID required' })

    const cart = await cartService.getCart(userId)
    sendSuccess(res, cart, 'Cart fetched')
  } catch (err) { next(err) }
}

const addItem = async (req, res, next) => {
  try {
    console.log('POST /cart/items headers.authorization =', req.headers.authorization)
    console.log('POST /cart/items req.user =', req.user)
    const userId = req.user?.userId || req.user?.id || req.user?.uid || req.user?.sub || req.headers['x-guest-id']
    const guestId = req.headers['x-guest-id']

    if (!userId && !guestId)
      return res.status(400).json({ success: false, message: 'User or guest ID required' })

    const cart = await cartService.addItem(userId, req.body)
    sendSuccess(res, cart, 'Item added to cart', 201)
  } catch (err) { next(err) }
}

const updateItem = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.uid || req.user?.sub || req.headers['x-guest-id']

    const quantity = req.body.quantity
    const cart = await cartService.updateItem(userId, req.params.itemId, quantity)

    sendSuccess(res, cart, 'Cart updated')
  } catch (err) { next(err) }
}

const removeItem = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.uid || req.user?.sub || req.headers['x-guest-id']

    const cart = await cartService.removeItem(userId, req.params.itemId)

    sendSuccess(res, cart, 'Item removed')
  } catch (err) { next(err) }
}

const clearCart = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.uid || req.user?.sub || req.headers['x-guest-id']

    const cart = await cartService.clearCart(userId)

    sendSuccess(res, cart, 'Cart cleared')
  } catch (err) { next(err) }
}

const mergeCarts = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?.uid || req.user?.sub

    const guestId = req.body.guestId
    if (!guestId)
      return res.status(400).json({ success: false, message: 'Guest ID required' })

    const cart = await cartService.mergeCarts(guestId, userId)

    sendSuccess(res, cart, 'Carts merged successfully')
  } catch (err) { next(err) }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, mergeCarts }