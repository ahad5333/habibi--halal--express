/**
 * Adds gift order columns to guest_orders.
 * Run once: node migrate-gift-order.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE guest_orders
        ADD COLUMN IF NOT EXISTS is_gift              BOOLEAN      DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS gift_recipient_name  VARCHAR(150),
        ADD COLUMN IF NOT EXISTS gift_recipient_phone VARCHAR(30),
        ADD COLUMN IF NOT EXISTS gift_message         TEXT
    `);
    console.log('✓ Gift order columns added to guest_orders');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
})();
