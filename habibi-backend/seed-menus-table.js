require("dotenv").config();
const pool = require("./src/config/db");

// price * 0.85 → partner price
const pp = (price) => Math.round(price * 0.85 * 100) / 100;

const ITEMS = [
  // ── Breakfast ────────────────────────────────────────────────────────────
  { category: 'Breakfast', name: 'Cream Cheese Sandwich',                    price:  2.99, image_url: '/images/menu/35f.jpg',  description: 'Fresh bagel, roll, or your preferred bread with cream cheese.' },
  { category: 'Breakfast', name: 'Eggs Sandwich',                            price:  2.99, image_url: '/images/menu/36.jpg',   description: 'Two grilled eggs with vegetable salad in your choice of bread with the sauce of your choice.' },
  { category: 'Breakfast', name: 'Eggs & Cheese Sandwich',                   price:  3.99, image_url: '/images/menu/37.jpg',   description: 'Two grilled eggs and cheese with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Eggs & Halal Bacon Sandwich',              price:  5.99, image_url: '/images/menu/37b.jpg',  description: 'Two grilled eggs and cheese with halal cured sliced beef or turkey bacon in your choice of bread.' },
  { category: 'Breakfast', name: 'Eggs & Hot Dog Sandwich',                  price:  5.50, image_url: '/images/menu/39.jpg',   description: 'Two grilled eggs and pieces of beef hot dog with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Eggs & Sausage Sandwich',                  price:  6.99, image_url: '/images/menu/40.jpg',   description: 'Two grilled eggs and pieces of seasoned beef hot sausage with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Eggs & Cheese & Sausage Sandwich',         price:  6.99, image_url: '/images/menu/40.jpg',   description: 'Two grilled eggs, cheese, and seasoned beef sausage in your choice of bread.' },
  { category: 'Breakfast', name: 'Eggs & Italian Sausage Sandwich',          price:  8.99, image_url: '/images/menu/41.jpg',   description: 'Two grilled eggs and extra large seasoned beef Italian sausage wrapped in your choice of bread.' },
  { category: 'Breakfast', name: 'Tuna Fish Salad Sandwich',                 price:  8.49, image_url: '/images/menu/0h2.jpg',  description: 'Special homemade fresh tuna fish with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Tuna Fish Egg Salad Melt Deluxe Sandwich', price:  9.99, image_url: '/images/menu/0h3.jpg',  description: 'Grilled eggs over homemade fresh tuna fish with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Tuna Fish Salad over Turkey Sandwich',     price: 10.99, image_url: '/images/menu/0h4.jpg',  description: 'Bold Salsalito turkey breast over homemade fresh tuna fish with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Turkey Sandwich',                          price:  8.99, image_url: '/images/menu/0h5.jpg',  description: 'Bold Salsalito turkey breast with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Turkey with Halal Bacon Sandwich',         price:  8.99, image_url: '/images/menu/0h6.jpg',  description: 'Turkey breast with halal cured sliced beef or turkey bacon and vegetable salad in your choice of bread.' },
  { category: 'Breakfast', name: 'Chopped Cheese Sandwich',                  price:  7.99, image_url: '/images/menu/35c.jpg',  description: 'Chopped grilled halal beef burger with American cheese in a hero with the sauce of your choice.' },
  { category: 'Breakfast', name: 'Halal Bacon Sandwich',                     price:  5.99, image_url: '/images/menu/35d.jpg',  description: 'Halal cured sliced beef or turkey bacon with or without American cheese in your choice of bread.' },
  { category: 'Breakfast', name: 'Halal Bacon and Sausage Sandwich',         price:  7.99, image_url: '/images/menu/35e.jpg',  description: 'Halal cured sliced beef or turkey bacon with pieces of seasoned beef sausage in your choice of bread.' },
  { category: 'Breakfast', name: 'Eggs & Cheese & Salad Plate',              price:  5.99, image_url: '/images/menu/20.jpg',   description: 'Two grilled eggs and cheese served with onion, green peppers, lettuce, tomatoes, and cucumber.' },
  { category: 'Breakfast', name: 'Eggs & Beef Burger & Salad Plate',         price:  8.99, image_url: '/images/menu/21.jpg',   description: 'Two grilled eggs and beef burger served with vegetable salad and the sauce of your choice.' },
  { category: 'Breakfast', name: 'Eggs & Hot Dog & Salad Plate',             price:  7.99, image_url: '/images/menu/22.jpg',   description: 'Two grilled eggs with pieces of beef hot dog served with vegetable salad.' },
  { category: 'Breakfast', name: 'Halal Bacon and Sausage Salad Plate',      price:  8.99, image_url: '/images/menu/22b.jpg',  description: 'Two grilled eggs and halal cured sliced beef or turkey bacon served with vegetable salad.' },
  { category: 'Breakfast', name: 'Eggs & Hot Sausage & Salad Plate',         price:  8.49, image_url: '/images/menu/23.jpg',   description: 'Two grilled eggs with pieces of beef hot sausage served with vegetable salad.' },
  { category: 'Breakfast', name: 'Eggs & Italian Sausage & Salad Plate',     price:  9.99, image_url: '/images/menu/24.jpg',   description: 'Two grilled eggs with pieces of large beef Italian sausage served with vegetable salad.' },
  { category: 'Breakfast', name: 'Donut',                                    price:  1.99, image_url: '/images/menu/49d.jpg',  description: 'Fresh baked donut of your choice from a variety of flavors.' },
  { category: 'Breakfast', name: 'Dozen Donuts',                             price: 13.99, image_url: '/images/menu/49d2.jpg', description: 'A mix of 12 fresh baked donuts.' },
  { category: 'Breakfast', name: 'Croissant',                                price:  2.49, image_url: '/images/menu/49e.jpg',  description: 'Fresh baked today croissant.' },
  { category: 'Breakfast', name: 'Muffin',                                   price:  2.99, image_url: '/images/menu/49f.jpg',  description: 'Fresh baked muffin of your choice.' },
  { category: 'Breakfast', name: 'Danish',                                   price:  2.99, image_url: '/images/menu/49g.jpg',  description: 'Fresh baked Danish of your choice — cheese or cinnamon.' },
  { category: 'Breakfast', name: 'Apple Turnover',                           price:  2.99, image_url: '/images/menu/49h.jpg',  description: 'Pastry dessert filled with sweetened apples, freshly baked today.' },

  // ── Platter ──────────────────────────────────────────────────────────────
  { category: 'Platter', name: 'Chicken over Rice',                          price:  9.99, image_url: '/images/menu/1.jpg',    description: 'Grilled chicken chunks over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', name: 'Chicken Salad',                              price:  9.99, image_url: '/images/menu/2.jpg',    description: 'Grilled chicken chunks with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', name: 'Chicken Fries',                              price:  9.99, image_url: '/images/menu/2.jpg',    description: 'Grilled chicken chunks with special French seasoned fries and the sauce of your choice.' },
  { category: 'Platter', name: 'Lamb over Rice',                             price:  9.99, image_url: '/images/menu/3.jpg',    description: 'Lamb gyro slices off the rotating gyro machine over rice with vegetable salad and sauce.' },
  { category: 'Platter', name: 'Lamb Salad',                                 price:  9.99, image_url: '/images/menu/4.jpg',    description: 'Lamb gyro slices with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', name: 'Lamb Fries',                                 price:  9.99, image_url: '/images/menu/4.jpg',    description: 'Lamb gyro slices with special French seasoned fries and the sauce of your choice.' },
  { category: 'Platter', name: 'Combo (Lamb & Chicken) over Rice',           price: 10.99, image_url: '/images/menu/5.jpg',    description: 'Grilled chicken and lamb gyro over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', name: 'Combo (Lamb & Chicken) Salad',               price: 10.99, image_url: '/images/menu/9.jpg',    description: 'Grilled chicken and lamb gyro with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', name: 'Combo (Lamb & Chicken) Fries',               price: 10.99, image_url: '/images/menu/5.jpg',    description: 'Grilled chicken and lamb gyro with special French seasoned fries and the sauce of your choice.' },
  { category: 'Platter', name: 'Half Chicken over Rice',                     price: 14.99, image_url: '/images/menu/6b.jpg',   description: 'Grilled specially seasoned half chicken on the bone over rice with vegetable salad.' },
  { category: 'Platter', name: 'Half Grilled Chicken Salad',                 price: 14.99, image_url: '/images/menu/6c.jpg',   description: 'Grilled specially seasoned half chicken on the bone served with vegetable salad.' },
  { category: 'Platter', name: 'Jumbo Shrimp over Rice',                     price: 10.99, image_url: '/images/menu/7b.jpg',   description: 'Fried fresh jumbo shrimp with special charcoal flavor over rice with vegetable salad.' },
  { category: 'Platter', name: 'Jumbo Shrimp Fries',                         price: 10.99, image_url: '/images/menu/7c.jpg',   description: 'Six fried fresh jumbo shrimp with special French fries and the sauce of your choice.' },
  { category: 'Platter', name: 'Jumbo Shrimp Salad',                         price: 10.99, image_url: '/images/menu/7d.jpg',   description: 'Six grilled fresh jumbo shrimp with lettuce, tomatoes, cucumber, onions, green peppers, and sauce.' },
  { category: 'Platter', name: 'Fish over Rice',                             price: 10.99, image_url: '/images/menu/7e.jpg',   description: 'Large specially breaded white fillet fish cutlets over rice with vegetable salad.' },
  { category: 'Platter', name: 'Fish over Salad',                            price: 10.99, image_url: '/images/menu/7f.jpg',   description: 'Large specially breaded white fillet fish cutlets with lettuce, tomatoes, cucumber, and sauce.' },
  { category: 'Platter', name: 'Fish with Fries',                            price: 10.99, image_url: '/images/menu/7f.jpg',   description: 'Large specially breaded white fillet fish cutlets with home seasoned fries and sauce.' },
  { category: 'Platter', name: 'Plain Chicken Wings over Rice',              price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six fresh fried wings over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', name: 'Buffalo Chicken Wings over Rice',            price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six spicy fried wings in special buffalo sauce over rice with vegetable salad.' },
  { category: 'Platter', name: 'BBQ Chicken Wings over Rice',                price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six BBQ fried wings in special BBQ sauce over rice with vegetable salad.' },
  { category: 'Platter', name: 'Plain Chicken Wings with Salad',             price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six fresh fried wings served with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', name: 'Buffalo Chicken Wings with Salad',           price:  9.99, image_url: '/images/menu/12.jpg',   description: 'Six spicy fried wings in special buffalo sauce served with vegetable salad.' },
  { category: 'Platter', name: 'BBQ Chicken Wings with Salad',               price:  9.99, image_url: '/images/menu/13.jpg',   description: 'Six BBQ fried wings in special BBQ sauce served with vegetable salad.' },
  { category: 'Platter', name: 'Plain Chicken Wings with Fries',             price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six fresh fried wings with special French seasoned fries and the sauce of your choice.' },
  { category: 'Platter', name: 'Buffalo Chicken Wings with Fries',           price:  9.99, image_url: '/images/menu/12.jpg',   description: 'Six spicy fried wings in special buffalo sauce with French seasoned fries.' },
  { category: 'Platter', name: 'BBQ Chicken Wings with Fries',               price:  9.99, image_url: '/images/menu/13.jpg',   description: 'Six BBQ fried wings in special BBQ sauce with French seasoned fries.' },
  { category: 'Platter', name: 'Falafel over Rice',                          price:  9.99, image_url: '/images/menu/14.jpg',   description: 'Eight homemade crispy fresh falafel over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', name: 'Falafel Salad',                              price:  8.99, image_url: '/images/menu/15.jpg',   description: 'Eight homemade crispy fresh falafel with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', name: 'Empanadas over Rice and Salad',              price: 10.99, image_url: '/images/menu/15b.jpg',  description: 'Two baby fried beef potato patties in Latin style served with rice and vegetable salad.' },
  { category: 'Platter', name: 'Tuna Fish Salad Plate',                      price:  8.49, image_url: '/images/menu/15c.jpg',  description: 'Special homemade fresh tuna fish with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', name: 'Tuna Fish Egg Salad Melt Deluxe Plate',      price:  9.99, image_url: '/images/menu/15d.jpg',  description: 'Grilled eggs over homemade fresh tuna fish with vegetable salad and sauce.' },
  { category: 'Platter', name: 'Turkey over Rice',                           price: 10.99, image_url: '/images/menu/15e.jpg',  description: 'Bold Salsalito turkey breast over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', name: 'Turkey with Halal Bacon Plate',              price: 10.99, image_url: '/images/menu/15f.jpg',  description: 'Turkey breast with halal cured beef or turkey bacon served with vegetable salad.' },
  { category: 'Platter', name: 'Italian Sausage over Rice',                  price:  9.99, image_url: '/images/menu/16.jpg',   description: 'Extra large grilled beef Italian sausage over rice with vegetable salad.' },
  { category: 'Platter', name: 'Italian Sausage Salad',                      price:  9.99, image_url: '/images/menu/17.jpg',   description: 'Extra large grilled beef Italian sausage with lettuce, tomatoes, cucumber, and sauce.' },
  { category: 'Platter', name: 'Double Chicken Shish Kebab over Rice',       price:  9.99, image_url: '/images/menu/18.jpg',   description: 'Charcoal grilled chicken chunks off two shish kebab sticks over rice with vegetable salad.' },
  { category: 'Platter', name: 'Double Chicken Shish Salad',                 price:  9.99, image_url: '/images/menu/19.jpg',   description: 'Charcoal grilled chicken chunks off two shish kebab sticks served with vegetable salad.' },
  { category: 'Platter', name: 'Double Beef Shish Kebab over Rice',          price:  9.99, image_url: '/images/menu/18b.jpg',  description: 'Charcoal grilled beef chunks off two shish kebab sticks over rice with vegetable salad.' },
  { category: 'Platter', name: 'Double Beef Shish Salad',                    price:  9.99, image_url: '/images/menu/19b.jpg',  description: 'Charcoal grilled beef chunks off two shish kebab sticks served with vegetable salad.' },

  // ── Sandwich ─────────────────────────────────────────────────────────────
  { category: 'Sandwich', name: 'Chicken Gyro',                              price:  7.99, image_url: '/images/menu/25.jpg',   description: 'Grilled chicken chunks with vegetable salad wrapped in pita bread with the sauce of your choice.' },
  { category: 'Sandwich', name: 'Lamb Gyro',                                 price:  7.99, image_url: '/images/menu/26.jpg',   description: 'Lamb gyro slices off the rotating gyro machine with vegetable salad wrapped in pita bread.' },
  { category: 'Sandwich', name: 'Combo (Lamb & Chicken) Sandwich',           price:  8.99, image_url: '/images/menu/27.jpg',   description: 'Grilled chicken and lamb gyro with vegetable salad wrapped in pita bread with sauce.' },
  { category: 'Sandwich', name: 'Jumbo Shrimp Sandwich',                     price:  8.99, image_url: '/images/menu/27b.jpg',  description: 'Grilled fresh jumbo shrimp with special charcoal flavor in your choice of bread and sauce.' },
  { category: 'Sandwich', name: 'Philly Cheesesteak',                        price:  6.99, image_url: '/images/menu/28.jpg',   description: 'Halal beef steak with sautéed peppers, onions, and melted cheese in a hoagie roll.' },
  { category: 'Sandwich', name: 'Chicken Philly',                            price:  9.99, image_url: '/images/menu/29.jpg',   description: 'Halal chicken with sautéed peppers, onions, and melted cheese in a hoagie roll.' },
  { category: 'Sandwich', name: 'Falafel Sandwich',                          price:  7.99, image_url: '/images/menu/30.jpg',   description: 'Eight homemade crispy fresh falafel with vegetable salad wrapped in pita bread with sauce.' },
  { category: 'Sandwich', name: 'Hot Dog',                                   price:  2.50, image_url: '/images/menu/31.jpg',   description: 'Grilled beef hot dog in a bun with the sauce of your choice.' },
  { category: 'Sandwich', name: 'Hot Sausage',                               price:  3.50, image_url: '/images/menu/31.jpg',   description: 'Grilled seasoned beef hot sausage in a bun with the sauce of your choice.' },
  { category: 'Sandwich', name: 'Italian Sausage Sandwich',                  price:  6.99, image_url: '/images/menu/32.jpg',   description: 'Extra large seasoned beef Italian hot sausage with vegetable salad wrapped in pita bread.' },
  { category: 'Sandwich', name: 'Fish Fillet Sandwich',                      price:  7.99, image_url: '/images/menu/27b.jpg',  description: 'Large specially breaded white fillet fish with vegetable salad in your choice of bread and sauce.' },
  { category: 'Sandwich', name: 'Chicken Shish Kebab Sandwich',              price:  5.99, image_url: '/images/menu/33.jpg',   description: 'Charcoal grilled chicken chunks off a shish kebab stick with vegetable salad in pita bread.' },
  { category: 'Sandwich', name: 'Beef Shish Kebab Sandwich',                 price:  6.99, image_url: '/images/menu/34b.jpg',  description: 'Charcoal grilled beef chunks off a shish kebab stick with vegetable salad in pita bread.' },
  { category: 'Sandwich', name: 'Double Chicken Shish Kebab Sandwich',       price:  8.99, image_url: '/images/menu/33.jpg',   description: 'Charcoal grilled chicken chunks off two shish kebab sticks with vegetable salad in pita bread.' },
  { category: 'Sandwich', name: 'Double Beef Shish Kebab Sandwich',          price:  9.99, image_url: '/images/menu/34b.jpg',  description: 'Charcoal grilled beef chunks off two shish kebab sticks with vegetable salad in pita bread.' },

  // ── Burgers ──────────────────────────────────────────────────────────────
  { category: 'Burgers', name: 'Beef Burger',                                price:  6.49, image_url: '/images/menu/35.jpg',   description: 'Grilled halal juicy beef burger with vegetable salad in a sandwich with the sauce of your choice.' },
  { category: 'Burgers', name: 'Chicken Burger',                             price:  6.49, image_url: '/images/menu/35a.jpg',  description: 'Grilled halal juicy chicken burger with vegetable salad in a sandwich with the sauce of your choice.' },
  { category: 'Burgers', name: 'Cheese Beef Burger',                         price:  6.99, image_url: '/images/menu/35b.jpg',  description: 'Grilled halal juicy beef burger with American cheese and vegetable salad.' },
  { category: 'Burgers', name: 'Cheese Chicken Burger',                      price:  6.99, image_url: '/images/menu/35b2.jpg', description: 'Grilled halal juicy chicken burger with American cheese and vegetable salad.' },
  { category: 'Burgers', name: 'Eggs & Beef Burger Sandwich',                price:  7.99, image_url: '/images/menu/38.jpg',   description: 'Two grilled eggs and beef burger with vegetable salad in your choice of bread.' },
  { category: 'Burgers', name: 'Eggs & Chicken Burger Sandwich',             price:  7.99, image_url: '/images/menu/38b.jpg',  description: 'Two grilled eggs and chicken burger with vegetable salad in your choice of bread.' },

  // ── Habibi Specials ───────────────────────────────────────────────────────
  { category: 'Habibi Specials', name: 'Habibi Jerk Plate',                  price:  4.99, image_url: '/images/menu/1.jpg',    description: 'Habibi signature jerk-seasoned plate served with rice and vegetable salad.' },

  // ── Tacos ─────────────────────────────────────────────────────────────────
  { category: 'Tacos', name: 'Chicken Taco',                                 price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with halal grilled chicken chunks and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', name: 'Beef Taco',                                    price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with halal ground beef and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', name: 'Lamb Taco',                                    price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with lamb gyro cuts and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', name: 'Beef Steak Taco',                              price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with beef steak chunks and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', name: 'Shrimp Taco',                                  price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with shrimp and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', name: 'Hot Dog Taco',                                 price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with a halal grilled beef hot dog and mixed vegetables.' },
  { category: 'Tacos', name: 'Sausage Taco',                                 price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with halal seasoned beef sausage pieces and mixed vegetables.' },
  { category: 'Tacos', name: 'Falafel Taco',                                 price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with homemade crispy fresh falafel and mixed vegetables.' },

  // ── Extras ────────────────────────────────────────────────────────────────
  { category: 'Extras', name: 'Mix Green Salad',                             price:  5.99, image_url: '/images/menu/7.jpg',    description: 'Fresh large plate with lettuce, tomatoes, cucumber, onions, green peppers, and the sauce of your choice.' },
  { category: 'Extras', name: 'Chicken Shish Kebab Stick',                   price:  4.99, image_url: '/images/menu/42.jpg',   description: 'Charcoal grilled chicken chunks on a shish kebab stick with the sauce of your choice.' },
  { category: 'Extras', name: 'Beef Shish Kebab Stick',                      price:  5.99, image_url: '/images/menu/42b.jpg',  description: 'Charcoal grilled beef chunks on a shish kebab stick with the sauce of your choice.' },
  { category: 'Extras', name: 'Pita Bread with White Sauce',                 price:  1.50, image_url: '/images/menu/43.jpg',   description: 'Pita bread heated and cut on the grill with special white sauce and garlic.' },
  { category: 'Extras', name: 'French Fries',                                price:  2.99, image_url: '/images/menu/44.jpg',   description: 'Fresh French fries with the sauce of your choice.' },
  { category: 'Extras', name: 'French Fries Plate (Large)',                  price:  4.99, image_url: '/images/menu/45.jpg',   description: 'A large plate of fresh French fries with the sauce of your choice.' },
  { category: 'Extras', name: 'Rice Plate',                                  price:  3.49, image_url: '/images/menu/46.jpg',   description: 'Special seasoned rice with the sauce of your choice.' },
  { category: 'Extras', name: 'Double Rice Plate',                           price:  4.99, image_url: '/images/menu/47.jpg',   description: 'A large plate of special seasoned rice with the sauce of your choice.' },
  { category: 'Extras', name: '4 Falafel with White Sauce',                  price:  3.50, image_url: '/images/menu/48.jpg',   description: 'Four homemade crispy fresh falafel with special white sauce.' },
  { category: 'Extras', name: 'Side Salad Mix Plate',                        price:  5.99, image_url: '/images/menu/48b.jpg',  description: 'Fresh side plate with lettuce, tomatoes, cucumber, onions, green peppers, and sauce.' },
  { category: 'Extras', name: 'Samosa',                                      price:  1.00, image_url: '/images/menu/49.jpg',   description: 'Fried pastry with a savory stuffing (one piece).' },
  { category: 'Extras', name: 'Empanada',                                    price:  3.99, image_url: '/images/menu/49a.jpg',  description: 'Baby fried beef potato pattie in Latin style with the sauce of your choice.' },
  { category: 'Extras', name: 'Mozzarella Sticks',                           price:  6.99, image_url: '/images/menu/49b.jpg',  description: 'Six homemade fried mozzarella cheese sticks served with the sauce of your choice.' },
  { category: 'Extras', name: 'Onion Rings',                                 price:  4.99, image_url: '/images/menu/44.jpg',   description: 'Homemade onion rings, fried super crispy and delicious.' },
  { category: 'Extras', name: 'Chocolate Cake',                              price:  3.99, image_url: '/images/menu/49i.jpg',  description: 'Fresh prepared cake slice with sweet and savory taste.' },

  // ── Drinks ───────────────────────────────────────────────────────────────
  { category: 'Drinks', name: 'Canned Soda',                                 price:  1.49, image_url: '/images/menu/50.jpg',   description: 'Can of soda — Pepsi, Diet Pepsi, Coke, Orange, Sprite, Ginger Ale, or Iced Tea.' },
  { category: 'Drinks', name: '2-Liter Pepsi',                               price:  2.99, image_url: '/images/menu/51.jpg',   description: 'Two-liter bottle of Pepsi.' },
  { category: 'Drinks', name: 'Bottled Water',                               price:  1.49, image_url: '/images/menu/52.jpg',   description: 'Poland Spring bottle of water, 16.9 fl oz.' },
  { category: 'Drinks', name: 'Snapple',                                     price:  2.99, image_url: '/images/menu/53.jpg',   description: 'Snapple juice bottle — Apple, Lemon Tea, or Peach.' },
  { category: 'Drinks', name: 'Gatorade',                                    price:  2.99, image_url: '/images/menu/53.jpg',   description: 'Gatorade thirst quencher — Lemon Lime, Orange, Fruit Punch, or Berry.' },
  { category: 'Drinks', name: 'Orange Juice',                                price:  2.99, image_url: '/images/menu/55.jpg',   description: 'Fresh orange juice.' },
  { category: 'Drinks', name: 'Apple Juice',                                 price:  2.99, image_url: '/images/menu/56.jpg',   description: 'Fresh apple juice.' },
  { category: 'Drinks', name: 'Cranberry Juice',                             price:  2.99, image_url: '/images/menu/57.jpg',   description: 'Fresh cranberry juice.' },
  { category: 'Drinks', name: 'Pineapple Juice',                             price:  2.99, image_url: '/images/menu/58.jpg',   description: 'Fresh pineapple juice.' },
  { category: 'Drinks', name: 'Mix Juice',                                   price:  3.99, image_url: '/images/menu/59.jpg',   description: 'Mix of any two or more fresh juices.' },
  { category: 'Drinks', name: 'Iced Coffee',                                 price:  2.99, image_url: '/images/menu/60.jpg',   description: 'Colombian coffee with your choice of flavor, sugar, and ice.' },
  { category: 'Drinks', name: 'Regular Hot Coffee',                          price:  2.49, image_url: '/images/menu/61.jpg',   description: 'Colombian coffee with your choice of flavor and sugar.' },
  { category: 'Drinks', name: 'Hot Chocolate',                               price:  2.49, image_url: '/images/menu/62.jpg',   description: 'Homemade hot chocolate with your choice of sugar.' },
  { category: 'Drinks', name: 'Tea',                                         price:  2.49, image_url: '/images/menu/63.jpg',   description: 'Homemade tea with your choice of kind and sugar.' },

  // ── Family Tray ───────────────────────────────────────────────────────────
  { category: 'Family Tray', name: 'Chicken over Rice Family Tray',          price: 31.99, image_url: '/images/menu/64.jpg',   description: 'Grilled chicken over rice with vegetable salad and sauces. Serves 4.' },
  { category: 'Family Tray', name: 'Lamb over Rice Family Tray',             price: 31.99, image_url: '/images/menu/65.jpg',   description: 'Lamb gyro over rice with vegetable salad and sauces. Serves 4.' },
  { category: 'Family Tray', name: 'Combo (Lamb & Chicken) Family Tray',    price: 34.99, image_url: '/images/menu/66.jpg',   description: 'Chicken and lamb gyro over rice with vegetable salad. Serves 4.' },
  { category: 'Family Tray', name: 'Whole Chicken over Rice',                price: 24.99, image_url: '/images/menu/66b.jpg',  description: 'Whole grilled specially seasoned chicken (cut in four pieces) over rice with vegetable salad.' },
  { category: 'Family Tray', name: 'Jumbo Shrimp Family Tray',               price: 36.99, image_url: '/images/menu/67.jpg',   description: 'Jumbo shrimp over rice with vegetable salad. Serves 4.' },
  { category: 'Family Tray', name: 'Fish over Rice Family Tray',             price: 36.99, image_url: '/images/menu/68.jpg',   description: 'Eight breaded fish cutlets over rice with vegetable salad. Serves 4.' },
  { category: 'Family Tray', name: 'Chicken Wings Family Tray',              price: 31.99, image_url: '/images/menu/69.jpg',   description: '24 fried wings over rice with vegetable salad — Buffalo, plain, or BBQ. Serves 4.' },
  { category: 'Family Tray', name: 'Eggs & Hot Sausage & Salad Family Tray',price: 29.99, image_url: '/images/menu/70.jpg',   description: 'Six grilled eggs with beef hot sausage and vegetable salad. Serves 4.' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    let skipped  = 0;

    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];

      // Skip if an item with the same name AND category already exists
      const exists = await client.query(
        `SELECT id FROM menus WHERE LOWER(name) = LOWER($1) AND LOWER(category) = LOWER($2) LIMIT 1`,
        [item.name, item.category]
      );
      if (exists.rows.length > 0) {
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO menus
           (name, description, category, categories, price, partner_price,
            image_url, sort_order, is_available, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true)`,
        [
          item.name,
          item.description,
          item.category,
          [item.category],          // categories array — single entry
          item.price,
          pp(item.price),
          item.image_url,
          i + 1,
        ]
      );
      inserted++;
      process.stdout.write(`  ✅ [${item.category.padEnd(14)}] ${item.name}\n`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Done — ${inserted} inserted, ${skipped} already existed`);
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
