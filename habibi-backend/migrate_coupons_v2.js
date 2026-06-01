const pool = require("./src/config/db");

async function migrate() {
  try {
    console.log("Starting Advanced Coupons migration...");

    // 1. Add new columns
    await pool.query(`
      ALTER TABLE coupons 
      ADD COLUMN IF NOT EXISTS target_product_id INTEGER REFERENCES menus(id),
      ADD COLUMN IF NOT EXISTS is_first_order_only BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_bogo BOOLEAN DEFAULT false;
    `);
    console.log("✓ Added target_product_id, is_first_order_only, and is_bogo columns");

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
