const pool = require("./src/config/db");

const initLogistics = async () => {
  try {
    console.log("Initializing Logistics Database Tables...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_tiers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        min_distance DECIMAL(5,2) NOT NULL,
        max_distance DECIMAL(5,2) NOT NULL,
        provider_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert Default Tiers if empty
    const { rows } = await pool.query("SELECT count(*) FROM delivery_tiers");
    if (parseInt(rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO delivery_tiers (name, min_distance, max_distance, provider_type) VALUES
        ('Internal Runner', 0, 3, 'in-house'),
        ('DoorDash Priority', 3, 7, 'doordash'),
        ('Uber Elite', 7, 12, 'uber'),
        ('Global Logistics (Grubhub)', 12, 50, 'grubhub')
      `);
      console.log("Default delivery tiers seeded.");
    }

    // Update orders table
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(50),
      ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS delivery_distance_miles DECIMAL(5,2);
    `);

    console.log("Logistics tables initialized successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Initialization Error:", err);
    process.exit(1);
  }
};

initLogistics();
