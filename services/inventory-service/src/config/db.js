const { Pool } = require('pg')
const { logger } = require('../../../../shared/logger')

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'nexcart',
  password: process.env.POSTGRES_PASSWORD || 'nexcart123',
  database: process.env.POSTGRES_DB || 'nexcart_users',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id VARCHAR(255) UNIQUE NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      reserved INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT quantity_positive CHECK (quantity >= 0),
      CONSTRAINT reserved_positive CHECK (reserved >= 0)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id VARCHAR(255) NOT NULL,
      order_id VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_product 
      ON inventory(product_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_order 
      ON reservations(order_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_product 
      ON reservations(product_id);
  `)
  logger.info('Inventory tables ready')
}

module.exports = { pool, initDB }