const { User, Customer } = require('./src/models');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log("--- Seeding Test Data via Sequelize ---");
    
    // 1. Seed Customer User
    const customerEmail = "test@example.com";
    let customerUser = await User.findOne({ where: { email: customerEmail } });
    
    if (!customerUser) {
      console.log("Creating test customer user...");
      customerUser = await User.create({
        email: customerEmail,
        phone_number: "1234567890",
        password_hash: "customer123",
        role: "customer",
        is_active: true,
        is_partner: false
      });
    } else {
      console.log("Test customer user already exists. Updating password...");
      customerUser.password_hash = "customer123";
      await customerUser.save();
    }

    // 2. Seed Customer Profile
    let customerProfile = await Customer.findOne({ where: { user_id: customerUser.id } });
    if (!customerProfile) {
      console.log("Creating customer profile...");
      customerProfile = await Customer.create({
        user_id: customerUser.id,
        first_name: "Test",
        last_name: "Customer",
        business_name: "Test Corp",
        date_of_birth: "1990-01-01",
        receive_sms_updates: true,
        receive_promotions: false,
        last_login: new Date()
      });
    } else {
      console.log("Customer profile already exists.");
    }

    // 3. Seed Admin User
    const adminEmail = "admin@habibihe.com";
    let adminUser = await User.findOne({ where: { email: adminEmail } });

    if (!adminUser) {
      console.log("Creating admin user...");
      adminUser = await User.create({
        email: adminEmail,
        phone_number: "9876543210",
        password_hash: "admin123",
        role: "admin",
        is_active: true,
        is_partner: false
      });
    } else {
      console.log("Admin user already exists. Updating password...");
      adminUser.password_hash = "admin123";
      await adminUser.save();
    }

    console.log("✅ Seeding completed successfully!");
    console.log(`- Customer: ${customerEmail} / customer123`);
    console.log(`- Admin: ${adminEmail} / admin123`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
