const pool = require('./src/config/db');

async function migratePhase7() {
  try {
    const client = await pool.connect();
    console.log('Connected to DB. Running Phase 7 migrations...');

    // 1. Add 'driver' role to ENUM safely
    try {
      await client.query(`ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'driver'`);
      console.log('Added driver role to user_role_enum');
    } catch (err) {
      console.log('Role enum might already contain driver or not be an enum:', err.message);
    }

    // 2. Add delivery_per_mile_fee to locations
    try {
      await client.query(`ALTER TABLE locations ADD COLUMN delivery_per_mile_fee DECIMAL(10,2) DEFAULT 0.00`);
      console.log('Added delivery_per_mile_fee to locations');
    } catch (err) {
      console.log('Column delivery_per_mile_fee might already exist:', err.message);
    }

    // 3. Add assigned_driver_id to orders
    try {
      await client.query(`ALTER TABLE orders ADD COLUMN assigned_driver_id INTEGER REFERENCES users(id)`);
      console.log('Added assigned_driver_id to orders');
    } catch (err) {
      console.log('Column assigned_driver_id might already exist:', err.message);
    }

    // 4. Add driver_location_lat and lng to orders
    try {
      await client.query(`ALTER TABLE orders ADD COLUMN driver_location_lat DECIMAL(10,8)`);
      await client.query(`ALTER TABLE orders ADD COLUMN driver_location_lng DECIMAL(11,8)`);
      console.log('Added driver_location coords to orders');
    } catch (err) {
      console.log('Columns driver_location coords might already exist:', err.message);
    }

    // 5. partner_order_id already exists in Order.js? Wait, it says partner_delivery_id. Let's add partner_order_id.
    try {
      await client.query(`ALTER TABLE orders ADD COLUMN partner_order_id VARCHAR(255)`);
      console.log('Added partner_order_id to orders');
    } catch (err) {
      console.log('Column partner_order_id might already exist:', err.message);
    }

    client.release();
    console.log('Phase 7 DB migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migratePhase7();
