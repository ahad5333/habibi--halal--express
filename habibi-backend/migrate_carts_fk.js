/**
 * Fix: carts.user_id FK was pointing to customers.id instead of users.id
 * The cart controller uses req.user.id (users.id) so the FK must reference users.
 */
process.chdir(__dirname);
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD
});
(async () => {
  await pool.query('ALTER TABLE carts DROP CONSTRAINT IF EXISTS carts_customer_id_fkey');
  await pool.query(`
    ALTER TABLE carts
    ADD CONSTRAINT carts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  `);
  console.log('OK: carts.user_id now references users.id');
  await pool.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
