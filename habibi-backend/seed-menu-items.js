require("dotenv").config();
const pool = require("./src/config/db");

const ITEMS = [
  // ── Breakfast ──────────────────────────────────────────────────────
  { category: 'Breakfast', title: 'Habibi Breakfast Platter',        price: 14.99, partner_price: 12.99, description: 'Two eggs any style, beef sausage, halal turkey, toast, and home fries.' },
  { category: 'Breakfast', title: 'Egg & Cheese on a Roll',          price: 6.99,  partner_price: 5.99,  description: 'Two fresh eggs with melted cheese on a toasted hard roll.' },
  { category: 'Breakfast', title: 'Beef Sausage, Egg & Cheese',      price: 8.99,  partner_price: 7.99,  description: 'Halal beef sausage patty, scrambled eggs, and American cheese.' },
  { category: 'Breakfast', title: 'Chicken & Waffle',                 price: 13.99, partner_price: 11.99, description: 'Crispy halal fried chicken on a golden waffle with maple syrup.' },
  { category: 'Breakfast', title: 'Steak & Egg Wrap',                 price: 12.99, partner_price: 10.99, description: 'Thinly sliced halal steak, scrambled eggs, peppers, and onions in a flour tortilla.' },

  // ── Platter ────────────────────────────────────────────────────────
  { category: 'Platter', title: 'Lamb Shawarma Plate',               price: 18.99, partner_price: 16.99, description: 'Slow-roasted spiced lamb over saffron rice with garlic sauce, pickles, and salad.' },
  { category: 'Platter', title: 'Chicken Kofta Plate',               price: 16.99, partner_price: 14.99, description: 'Seasoned ground chicken kofta skewers over rice pilaf with tzatziki.' },
  { category: 'Platter', title: 'Mixed Grill Platter',               price: 24.99, partner_price: 21.99, description: 'Lamb kofta, chicken shish, and beef kebab over rice with grilled vegetables.' },
  { category: 'Platter', title: 'Gyro Over Rice',                    price: 15.99, partner_price: 13.99, description: 'Thinly sliced halal gyro meat over seasoned rice with white and hot sauce.' },
  { category: 'Platter', title: 'Falafel Plate',                     price: 13.99, partner_price: 11.99, description: 'Six crispy falafel balls over hummus and rice with tahini sauce and pita.' },
  { category: 'Platter', title: 'Chicken Over Rice',                 price: 14.99, partner_price: 12.99, description: 'Habibi signature chicken over yellow rice with lettuce, tomato, white sauce, and hot sauce.' },
  { category: 'Platter', title: 'Shrimp Platter',                    price: 19.99, partner_price: 17.99, description: 'Seasoned jumbo shrimp over garlic herb rice with lemon and garlic aioli.' },

  // ── Sandwich ───────────────────────────────────────────────────────
  { category: 'Sandwich', title: 'Chicken Shawarma Wrap',            price: 12.99, partner_price: 10.99, description: 'Marinated chicken shawarma in a warm pita with garlic paste, pickles, and fries.' },
  { category: 'Sandwich', title: 'Beef Gyro Wrap',                   price: 12.99, partner_price: 10.99, description: 'Sliced halal beef gyro in a flatbread with lettuce, tomato, onion, and tzatziki.' },
  { category: 'Sandwich', title: 'Habibi Cheesesteak',               price: 14.99, partner_price: 12.99, description: 'Thinly sliced halal ribeye, sautéed peppers and onions, provolone, on a hoagie roll.' },
  { category: 'Sandwich', title: 'Crispy Chicken Sandwich',          price: 13.99, partner_price: 11.99, description: 'Hand-breaded crispy halal chicken breast, pickles, and spicy mayo on a brioche bun.' },
  { category: 'Sandwich', title: 'Lamb Burger',                      price: 15.99, partner_price: 13.99, description: 'Seasoned ground lamb patty with lettuce, tomato, caramelized onion, and harissa aioli.' },
  { category: 'Sandwich', title: 'Falafel Wrap',                     price: 10.99, partner_price: 9.49,  description: 'Crispy falafel, mixed greens, tomato, tahini, and pickled turnip in a warm pita.' },

  // ── Tacos ──────────────────────────────────────────────────────────
  { category: 'Tacos', title: 'Lamb Kofta Tacos (2)',                price: 11.99, partner_price: 9.99,  description: 'Two soft corn tortillas with spiced lamb kofta, pickled red onion, and cilantro crema.' },
  { category: 'Tacos', title: 'Chicken Shawarma Tacos (2)',          price: 10.99, partner_price: 8.99,  description: 'Marinated chicken shawarma in flour tortillas with cabbage slaw and garlic sauce.' },
  { category: 'Tacos', title: 'Beef Barbacoa Tacos (2)',             price: 12.99, partner_price: 10.99, description: 'Slow-cooked spiced halal beef in corn tortillas with diced onion and fresh cilantro.' },
  { category: 'Tacos', title: 'Crispy Shrimp Tacos (2)',             price: 13.99, partner_price: 11.99, description: 'Crispy seasoned shrimp, avocado crema, mango salsa, and pickled jalapeños.' },
  { category: 'Tacos', title: 'Gyro Tacos (2)',                      price: 11.99, partner_price: 9.99,  description: 'Sliced halal gyro meat in warm pita tortillas with tzatziki and diced tomato.' },

  // ── Build Your Own ────────────────────────────────────────────────
  { category: 'Build Your Own', title: 'Build Your Own Bowl',        price: 13.99, partner_price: 11.99, description: 'Choose your base, protein, toppings, and sauce. Fully customized to your taste.' },
  { category: 'Build Your Own', title: 'Build Your Own Wrap',        price: 12.99, partner_price: 10.99, description: 'Pick your protein, veggies, and sauce wrapped in a fresh flour tortilla or pita.' },
  { category: 'Build Your Own', title: 'Build Your Own Platter',     price: 17.99, partner_price: 15.99, description: 'Choose two proteins, your base, two sides, and two sauces.' },

  // ── Extras ────────────────────────────────────────────────────────
  { category: 'Extras', title: 'Habibi Fries',                       price: 4.99,  partner_price: 3.99,  description: 'Crispy seasoned fries with our signature Habibi spice blend.' },
  { category: 'Extras', title: 'Cheese Fries',                       price: 6.99,  partner_price: 5.99,  description: 'Golden fries smothered in melted cheddar cheese sauce.' },
  { category: 'Extras', title: 'Hummus & Pita',                      price: 6.99,  partner_price: 5.99,  description: 'Creamy house-made hummus with warm pita bread and olive oil drizzle.' },
  { category: 'Extras', title: 'Side Salad',                         price: 4.99,  partner_price: 3.99,  description: 'Mixed greens, tomato, cucumber, red onion, and lemon-herb vinaigrette.' },
  { category: 'Extras', title: 'Rice (Side)',                        price: 3.99,  partner_price: 2.99,  description: 'Seasoned yellow rice with herbs.' },
  { category: 'Extras', title: 'Extra Sauce',                        price: 1.49,  partner_price: 0.99,  description: 'White sauce, hot sauce, tahini, garlic paste, or tzatziki.' },
  { category: 'Extras', title: 'Mozzarella Sticks (4)',              price: 7.99,  partner_price: 6.99,  description: 'Crispy breaded mozzarella sticks with marinara dipping sauce.' },
  { category: 'Extras', title: 'Onion Rings',                        price: 5.99,  partner_price: 4.99,  description: 'Thick-cut battered onion rings, perfectly golden and crispy.' },
];

async function seed() {
  try {
    // Get all categories into a map
    const catRows = await pool.query("SELECT id, name FROM categories");
    const catMap = {};
    catRows.rows.forEach(r => { catMap[r.name.toLowerCase()] = r.id; });

    let inserted = 0;
    let skipped  = 0;

    for (const item of ITEMS) {
      // Find or create category
      let catId = catMap[item.category.toLowerCase()];
      if (!catId) {
        const c = await pool.query(
          "INSERT INTO categories (name) VALUES ($1) RETURNING id",
          [item.category]
        );
        catId = c.rows[0].id;
        catMap[item.category.toLowerCase()] = catId;
      }

      // Insert item (skip if same title already exists)
      const exists = await pool.query(
        "SELECT id FROM menu_items WHERE LOWER(title) = LOWER($1)", [item.title]
      );
      if (exists.rows.length > 0) { skipped++; continue; }

      await pool.query(
        `INSERT INTO menu_items (title, description, price, partner_price, category_id, is_available, preference)
         VALUES ($1, $2, $3, $4, $5, true, 1)`,
        [item.title, item.description, item.price, item.partner_price, catId]
      );
      inserted++;
      console.log(`  ✅ ${item.category.padEnd(16)} — ${item.title}`);
    }

    console.log(`\n✅ Done — ${inserted} items inserted, ${skipped} skipped (already exist)`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

seed();
