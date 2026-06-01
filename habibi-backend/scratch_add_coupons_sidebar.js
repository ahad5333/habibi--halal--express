const pool = require("./src/config/db");

async function addSidebarItem() {
  try {
    // Check if it exists
    const check = await pool.query("SELECT * FROM admin_sidebar WHERE path = '/admin/coupons'");
    if (check.rows.length === 0) {
      await pool.query(`
        INSERT INTO admin_sidebar (name, path, icon, sort_order, is_active)
        VALUES ('Coupons', '/admin/coupons', '🎟️', 10, TRUE)
      `);
      console.log("✓ Added Coupons to admin_sidebar");
    } else {
      console.log("Coupons already in sidebar");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

addSidebarItem();
