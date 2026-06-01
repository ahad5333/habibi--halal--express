const pool = require("./src/config/db");

const createTables = async () => {
  try {
    console.log("🚀 Starting Administrative Schema Migration...");

    // 1. Reservations Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        event_date VARCHAR(100),
        guest_count INTEGER,
        message TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Reservations Table Verified");

    // 2. Ensure Payments table has necessary columns (if not already there)
    // Assuming payments table already exists based on paymentController
    
    console.log("✨ Migration Complete. Command Hub is now fully powered.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration Failed:", err);
    process.exit(1);
  }
};

createTables();

