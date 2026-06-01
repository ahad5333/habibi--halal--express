const pool = require("./src/config/db");

async function seedFrontendItems() {
  const items = [
    { name: 'Chicken burger', price: 18.00, category: 'Burgers', description: 'Freshly grilled chicken burger' },
    { name: 'Beef Pizza', price: 16.00, category: 'Pizza', description: 'Classic beef pizza with premium cheese' },
    { name: 'Shawarma', price: 15.00, category: 'Sandwich', description: 'Authentic Middle Eastern shawarma wrap' },
    { name: 'Ice cream', price: 13.00, category: 'Desserts', description: 'Rich and creamy dessert' },
    { name: 'Special pasta', price: 20.00, category: 'Platter', description: 'House special pasta with signature sauce' }
  ];

  try {
    for (const item of items) {
      await pool.query(
        "INSERT INTO menus (name, price, category, description) VALUES ($1, $2, $3, $4)",
        [item.name, item.price, item.category, item.description]
      );
      console.log(`Inserted: ${item.name}`);
    }
    console.log("Successfully seeded frontend items!");
  } catch (error) {
    console.error("Error seeding items:", error);
  } finally {
    process.exit();
  }
}

seedFrontendItems();
