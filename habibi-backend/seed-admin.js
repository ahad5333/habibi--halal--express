const pool = require("./src/config/db");
const bcrypt = require("bcryptjs");

const seedAdmin = async () => {
  try {
    const name = "Habibi Admin";
    const email = "admin@habibi.com";
    const password = "admin123";
    const role = "admin";

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO users(name, email, password, role)
      VALUES($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
      `,
      [name, email, hashedPassword, role]
    );

    console.log("Admin user seeded successfully!");
    console.log("Email: " + email);
    console.log("Password: " + password);
    process.exit();
  } catch (err) {
    console.error("Error seeding admin:", err);
    process.exit(1);
  }
};

seedAdmin();

