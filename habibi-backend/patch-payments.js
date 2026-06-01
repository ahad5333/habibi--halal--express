const pool = require("./src/config/db");

const patchPayments = async () => {
  try {
    console.log("--- Patching Payments Table for Financial Compliance ---");
    await pool.query(`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;
    `);
    console.log("✅ Payments table patched!");
  } catch (err) {
    console.error("❌ Error patching payments:", err.message);
  } finally {
    process.exit();
  }
};

patchPayments();
