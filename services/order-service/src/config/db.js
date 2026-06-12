const { Pool } = require('pg')
const logger = require('../../../../shared/logger')

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
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      idempotency_key VARCHAR(255) UNIQUE,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      items JSONB NOT NULL,
      shipping_address JSONB NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      tax DECIMAL(10,2) DEFAULT 0,
      shipping_fee DECIMAL(10,2) DEFAULT 0,
      total DECIMAL(10,2) NOT NULL,
      payment_intent_id VARCHAR(255),
      notes TEXT,
      cancelled_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT valid_status CHECK (
        status IN (
          'pending','confirmed','processing',
          'shipped','delivered','cancelled','refunded'
        )
      )
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id),
      event_type VARCHAR(100) NOT NULL,
      payload JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user 
      ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status 
      ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_idempotency 
      ON orders(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_order_events_order 
      ON order_events(order_id);
  `)
  logger.info('Order tables ready')
}

module.exports = { pool, initDB }