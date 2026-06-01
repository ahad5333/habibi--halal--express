const pool = require("./src/config/db");

const initPartners = async () => {
  try {
    console.log("--- Initializing Partner Portal Infrastructure ---");

    // 1. Partner Applications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS partner_applications (
        id SERIAL PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        ein_number VARCHAR(50) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        address TEXT,
        certificate_url VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
        price_tier VARCHAR(50) DEFAULT 'Standard', -- Standard, Silver, Gold, Platinum
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Extend Users table to link to Partner (if approved)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;
    `);

    console.log("✅ Partner Portal tables initialized!");
  } catch (err) {
    console.error("❌ Failed to initialize partner tables:", err.message);
  } finally {
    process.exit();
  }
};

initPartners();

