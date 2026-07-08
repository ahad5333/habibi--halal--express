/**
 * Adds menu_item_id FK column to inventory_items so stock changes
 * can automatically flip the linked menu item's sold_out status.
 * Run once: node migrate-inventory-link.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE inventory_items
        ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES menus(id) ON DELETE SET NULL
    `);
    console.log('✓ menu_item_id column added to inventory_items');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
})();
