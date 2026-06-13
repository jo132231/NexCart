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
  connectionTimeoutMillis: 2000
})

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      stripe_payment_intent_id VARCHAR(255) UNIQUE,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'usd',
      status VARCHAR(30) DEFAULT 'pending',
      stripe_customer_id VARCHAR(255),
      failure_reason TEXT,
      refund_id VARCHAR(255),
      refunded_amount DECIMAL(10,2),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT valid_payment_status CHECK (
        status IN (
          'pending','processing','succeeded',
          'failed','cancelled','refunded','partially_refunded'
        )
      )
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      processed BOOLEAN DEFAULT false,
      payload JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payments_order 
      ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_intent 
      ON payments(stripe_payment_intent_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_stripe_id 
      ON webhook_events(stripe_event_id);
  `)
  logger.info('Payment tables ready')
}

module.exports = { pool, initDB }