const { pool } = require('../config/db')
const { AppError } = require('../../../../shared/errorHandler')
const logger = require('../../../../shared/logger')

const getStock = async (productId) => {
  const result = await pool.query(
    `SELECT 
      product_id,
      product_name,
      quantity,
      reserved,
      quantity - reserved AS available,
      low_stock_threshold,
      version,
      updated_at,
      CASE 
        WHEN quantity - reserved <= 0 THEN 'out_of_stock'
        WHEN quantity - reserved <= low_stock_threshold THEN 'low_stock'
        ELSE 'in_stock'
      END AS status
     FROM inventory 
     WHERE product_id = $1`,
    [productId]
  )

  if (result.rows.length === 0) {
    throw new AppError('Product not found in inventory', 404)
  }

  return result.rows[0]
}

const updateStock = async (productId, { quantity, productName, lowStockThreshold }) => {
  // Upsert — insert if not exists, update if exists
  const result = await pool.query(
    `INSERT INTO inventory 
       (product_id, product_name, quantity, low_stock_threshold)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id) DO UPDATE SET
       quantity = $3,
       product_name = COALESCE($2, inventory.product_name),
       low_stock_threshold = COALESCE($4, inventory.low_stock_threshold),
       version = inventory.version + 1,
       updated_at = NOW()
     RETURNING *`,
    [productId, productName, quantity, lowStockThreshold || 10]
  )

  logger.info(`Stock updated: ${productId} → ${quantity} units`)
  return result.rows[0]
}

const reserveStock = async ({ productId, orderId, quantity }) => {
  // Use a database transaction — all or nothing
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Read current stock with optimistic lock version
    const stockResult = await client.query(
      `SELECT quantity, reserved, version 
       FROM inventory 
       WHERE product_id = $1
       FOR UPDATE`,  // locks this row during transaction
      [productId]
    )

    if (stockResult.rows.length === 0) {
      throw new AppError('Product not found in inventory', 404)
    }

    const { quantity: total, reserved, version } = stockResult.rows[0]
    const available = total - reserved

    if (available < quantity) {
      throw new AppError(
        `Insufficient stock. Requested: ${quantity}, Available: ${available}`,
        409
      )
    }

    // Update reserved count with optimistic lock check
    const updateResult = await client.query(
      `UPDATE inventory 
       SET reserved = reserved + $1,
           version = version + 1,
           updated_at = NOW()
       WHERE product_id = $2 AND version = $3
       RETURNING *`,
      [quantity, productId, version]
    )

    // If version changed between our read and update — conflict
    if (updateResult.rows.length === 0) {
      throw new AppError('Stock update conflict, please retry', 409)
    }

    // Record the reservation
    const reservation = await client.query(
      `INSERT INTO reservations 
         (product_id, order_id, quantity, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')
       RETURNING *`,
      [productId, orderId, quantity]
    )

    await client.query('COMMIT')

    logger.info(`Stock reserved: ${quantity} units of ${productId} for order ${orderId}`)

    return {
      reservation: reservation.rows[0],
      remainingAvailable: available - quantity
    }

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()  // always release connection back to pool
  }
}

const releaseStock = async ({ orderId, productId }) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Find active reservations for this order
    const reservationQuery = productId
      ? `SELECT * FROM reservations 
         WHERE order_id = $1 AND product_id = $2 AND status = 'active'`
      : `SELECT * FROM reservations 
         WHERE order_id = $1 AND status = 'active'`

    const params = productId ? [orderId, productId] : [orderId]
    const reservations = await client.query(reservationQuery, params)

    if (reservations.rows.length === 0) {
      throw new AppError('No active reservations found', 404)
    }

    // Release each reservation
    for (const reservation of reservations.rows) {
      await client.query(
        `UPDATE inventory 
         SET reserved = reserved - $1,
             version = version + 1,
             updated_at = NOW()
         WHERE product_id = $2`,
        [reservation.quantity, reservation.product_id]
      )

      await client.query(
        `UPDATE reservations 
         SET status = 'released' 
         WHERE id = $1`,
        [reservation.id]
      )
    }

    await client.query('COMMIT')
    logger.info(`Stock released for order: ${orderId}`)

    return { released: reservations.rows.length }

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = { getStock, updateStock, reserveStock, releaseStock }