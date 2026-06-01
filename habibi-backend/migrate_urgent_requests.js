const pool = require("./src/config/db");

async function migrateUrgentRequests() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS urgent_requests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        order_id VARCHAR(100),
        reason VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        urgency_level VARCHAR(50) DEFAULT 'High',
        status VARCHAR(50) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created urgent_requests table");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrateUrgentRequests();
