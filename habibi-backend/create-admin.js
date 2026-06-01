require("dotenv").config();
const pool = require("./src/config/db");
const bcrypt = require("bcryptjs");

(async () => {
  try {
    const email    = "admin@habibihe.com";
    const password = "Habibi@Admin2025";
    const name     = "Habibi Admin";

    const hash = await bcrypt.hash(password, 10);

    await pool.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role          = 'admin',
            username      = EXCLUDED.username
    `, [name, email, hash]);

    console.log("✅ Admin user ready");
    console.log("   Email   : " + email);
    console.log("   Password: " + password);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
})();
