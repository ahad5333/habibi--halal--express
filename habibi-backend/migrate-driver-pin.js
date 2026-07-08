/**
 * Adds PIN authentication columns to staff_members for driver login.
 * Run once: node migrate-driver-pin.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS driver_pin_hash VARCHAR(100)`);
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS driver_pin_attempts INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS driver_pin_lockout_until TIMESTAMPTZ`);
    console.log('✓ driver_pin_hash, driver_pin_attempts, driver_pin_lockout_until added to staff_members');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
})();
