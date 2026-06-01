const pool = require("./src/config/db");

async function migrate() {
  try {
    console.log("Starting Routing & Stock migration...");

    // 1. Add location_id to orders
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
    `);
    console.log("✓ Added location_id to orders table");

    // 2. Create location_stock table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_stock (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        menu_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
        is_available BOOLEAN DEFAULT true,
        stock_count INTEGER DEFAULT 999,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(location_id, menu_id)
      );
    `);
    console.log("✓ Created location_stock table");

    // 3. Seed location_stock for existing menus and locations
    const locations = await pool.query("SELECT id FROM locations");
    const menus = await pool.query("SELECT id FROM menus");

    for (let loc of locations.rows) {
      for (let menu of menus.rows) {
        await pool.query(`
          INSERT INTO location_stock (location_id, menu_id)
          VALUES ($1, $2)
          ON CONFLICT (location_id, menu_id) DO NOTHING
        `, [loc.id, menu.id]);
      }
    }
    console.log(`✓ Seeded stock for ${locations.rows.length} locations and ${menus.rows.length} menu items`);

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
