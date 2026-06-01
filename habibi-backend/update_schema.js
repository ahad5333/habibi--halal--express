const pool = require("./src/config/db");

async function updateSchema() {
  try {
    console.log("--- Updating Users Table ---");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45),
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
    `);
    console.log("✅ Added last_ip and last_login columns to users table");

    console.log("\n--- Updating Admin Sidebar ---");
    // Check if Customers already exists
    const res = await pool.query("SELECT * FROM admin_sidebar WHERE path = '/admin/customers'");
    if (res.rows.length === 0) {
      await pool.query(`
        INSERT INTO admin_sidebar (name, path, icon, sort_order, is_active)
        VALUES ('Customers', '/admin/customers', '👥', 2, TRUE)
      `);
      console.log("✅ Added 'Customers' to admin_sidebar");
      
      // Update other sort orders to make space if needed
      // Current orders from check_db:
      // Dashboard: 1
      // Menu Studio: 3
      // Payments: 4
      // Reservations: 5
      // Settings: 6
      // Locations: 7
      // So 2 is perfect for Customers.
    } else {
      console.log("ℹ️ 'Customers' already exists in admin_sidebar");
    }

    console.log("\n--- Schema Update Completed ---");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating schema:", err);
    process.exit(1);
  }
}

updateSchema();
