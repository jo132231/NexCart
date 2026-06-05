const redis = require('../config/redis')
const logger = require('../../../../shared/logger')
const { AppError } = require('../../../../shared/errorHandler')

const CART_TTL = 7 * 24 * 60 * 60  // 7 days in seconds

// Every cart key follows this pattern
const getCartKey = (id) => `cart:${id}`

const getCart = async (userId) => {
  const key = getCartKey(userId)

  // Get all fields from the Redis hash
  const cartData = await redis.hgetall(key)

  if (!cartData || Object.keys(cartData).length === 0) {
    return { items: [], total: 0, itemCount: 0 }
  }

  // Parse each item (stored as JSON string)
  const items = Object.entries(cartData).map(([productId, value]) => ({
    productId,
    ...JSON.parse(value)
  }))

  // Calculate totals
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    items,
    total: Math.round(total * 100) / 100,  // round to 2 decimal places
    itemCount
  }
}

const addItem = async (userId, { productId, name, price, image, quantity = 1 }) => {
  const key = getCartKey(userId)

  // Check if item already exists in cart
  const existing = await redis.hget(key, productId)

  if (existing) {
    // Item exists — just increase quantity
    const item = JSON.parse(existing)
    item.quantity += quantity
    item.updatedAt = new Date().toISOString()
    await redis.hset(key, productId, JSON.stringify(item))
  } else {
    // New item — add it
    const item = {
      name,
      price,
      image: image || null,
      quantity,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await redis.hset(key, productId, JSON.stringify(item))
  }

  // Reset TTL on every cart interaction — 7 days from NOW
  await redis.expire(key, CART_TTL)

  logger.info(`Item added to cart: ${userId} → ${productId}`)
  return getCart(userId)
}

const updateItem = async (userId, productId, quantity) => {
  const key = getCartKey(userId)

  if (quantity <= 0) {
    // Quantity 0 or negative means remove the item
    return removeItem(userId, productId)
  }

  const existing = await redis.hget(key, productId)
  if (!existing) throw new AppError('Item not found in cart', 404)

  const item = JSON.parse(existing)
  item.quantity = quantity
  item.updatedAt = new Date().toISOString()

  await redis.hset(key, productId, JSON.stringify(item))
  await redis.expire(key, CART_TTL)  // reset TTL

  return getCart(userId)
}

const removeItem = async (userId, productId) => {
  const key = getCartKey(userId)

  const existing = await redis.hget(key, productId)
  if (!existing) throw new AppError('Item not found in cart', 404)

  // hdel removes a specific field from the hash
  await redis.hdel(key, productId)
  await redis.expire(key, CART_TTL)

  logger.info(`Item removed from cart: ${userId} → ${productId}`)
  return getCart(userId)
}

const clearCart = async (userId) => {
  const key = getCartKey(userId)
  await redis.del(key)
  logger.info(`Cart cleared: ${userId}`)
  return { items: [], total: 0, itemCount: 0 }
}

// Called when a guest user logs in
// Merges guest cart into user cart then deletes guest cart
const mergeCarts = async (guestId, userId) => {
  const guestKey = getCartKey(guestId)
  const guestCart = await redis.hgetall(guestKey)

  if (!guestCart || Object.keys(guestCart).length === 0) {
    // No guest cart to merge
    return getCart(userId)
  }

  // For each item in guest cart, add it to user cart
  for (const [productId, value] of Object.entries(guestCart)) {
    const guestItem = JSON.parse(value)
    const userKey = getCartKey(userId)
    const existingItem = await redis.hget(userKey, productId)

    if (existingItem) {
      // Item exists in both carts — combine quantities
      const userItem = JSON.parse(existingItem)
      userItem.quantity += guestItem.quantity
      userItem.updatedAt = new Date().toISOString()
      await redis.hset(userKey, productId, JSON.stringify(userItem))
    } else {
      // Item only in guest cart — move it over
      await redis.hset(userKey, productId, value)
    }
  }

  // Delete guest cart after merging
  await redis.del(guestKey)
  await redis.expire(getCartKey(userId), CART_TTL)

  logger.info(`Guest cart merged: ${guestId} → ${userId}`)
  return getCart(userId)
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, mergeCarts }