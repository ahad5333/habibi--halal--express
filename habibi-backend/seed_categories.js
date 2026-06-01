const pool = require("./src/config/db");

async function seedCategories() {
  const { rows: items } = await pool.query("SELECT id, name FROM menus");
  
  for (const item of items) {
    let category = "Extras";
    const name = item.name.toLowerCase();
    
    if (name.includes("sandwich") || name.includes("bagel") || name.includes("roll")) category = "Sandwich";
    else if (name.includes("platter")) category = "Platter";
    else if (name.includes("taco")) category = "Tacos";
    else if (name.includes("breakfast") || name.includes("egg") || name.includes("pancake")) category = "Breakfast";
    else if (name.includes("pizza")) category = "Pizza";
    else if (name.includes("drink") || name.includes("shake") || name.includes("soda") || name.includes("beverage")) category = "Drinks";
    else if (name.includes("salad") || name.includes("sides") || name.includes("hummus")) category = "Sides";
    else if (name.includes("create") || name.includes("build your own")) category = "Build Your Own";
    
    await pool.query("UPDATE menus SET category = $1 WHERE id = $2", [category, item.id]);
  }
  
  console.log("Successfully seeded categories for all menu items.");
  process.exit();
}

seedCategories().catch(console.error);
