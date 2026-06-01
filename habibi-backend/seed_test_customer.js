const pool = require("./src/config/db");
const bcrypt = require("bcryptjs");

async function seedTestData() {
  try {
    console.log("--- Seeding Test Customer ---");
    const password = await bcrypt.hash("customer123", 10);
    const userResult = await pool.query(`
      INSERT INTO users (name, email, password, phone, role, balance, last_ip, last_login)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password
      RETURNING id
    `, ["Test Customer", "test@example.com", password, "1234567890", "user", 150.75, "127.0.0.1", new Date()]);

    const userId = userResult.rows[0].id;
    console.log(`✅ Test customer created/updated with ID: ${userId}`);

    console.log("\n--- Seeding Test Order ---");
    const orderResult = await pool.query(`
      INSERT INTO orders (user_id, total_amount, status, payment_status, payment_method, delivery_address)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [userId, 45.50, "delivered", "paid", "Credit Card", "123 Test Lane, New York, NY"]);
    
    console.log(`✅ Test order created with ID: ${orderResult.rows[0].id}`);

    console.log("\n--- Seeding Test Payment Method ---");
    await pool.query(`
      INSERT INTO payment_methods (user_id, provider, last4, brand, is_default, expiry)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, "stripe", "4242", "visa", true, "12/26"]);
    
    console.log("✅ Test payment method added");

    console.log("\n--- Seeding Test Address ---");
    await pool.query(`
      INSERT INTO user_addresses (user_id, label, receiver_name, address_line_1, city, state, zip)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, "Home", "Test Customer", "123 Test Lane", "New York", "NY", "10001"]);
    
    console.log("✅ Test address added");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding test data:", err);
    process.exit(1);
  }
}

seedTestData();

