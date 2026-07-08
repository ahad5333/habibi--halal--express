/**
 * Adds UTM attribution columns to guest_orders.
 * Run once: node migrate-utm.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE guest_orders
        ADD COLUMN IF NOT EXISTS utm_source   VARCHAR(100),
        ADD COLUMN IF NOT EXISTS utm_medium   VARCHAR(100),
        ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100),
        ADD COLUMN IF NOT EXISTS utm_content  VARCHAR(100)
    `);
    console.log('✓ UTM columns added to guest_orders');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
})();
