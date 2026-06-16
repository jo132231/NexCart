const { Pool } = require('pg')
const logger = require('../../../../shared/logger')

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'nexcart',
  password: process.env.POSTGRES_PASSWORD || 'nexcart123',
  database: process.env.POSTGRES_DB || 'nexcart_users',
  max: 20,
  idleTimeoutMillis: 30000
})

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255),
      type VARCHAR(50) NOT NULL,
      channel VARCHAR(20) NOT NULL,
      subject VARCHAR(255),
      content TEXT NOT NULL,
      metadata JSONB,
      status VARCHAR(20) DEFAULT 'sent',
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read
      ON notifications(user_id, read);
  `)
  logger.info('Notification tables ready')
}

module.exports = { pool, initDB }