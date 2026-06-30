require("dotenv").config();
const pool = require("./src/config/db");

// partner_price = 85% of regular price
const pp = (price) => Math.round(price * 0.85 * 100) / 100;

const ITEMS = [
  // ── Breakfast ────────────────────────────────────────────────────────────
  { category: 'Breakfast', title: 'Cream Cheese Sandwich',                   price:  2.99, image_url: '/images/menu/35f.jpg',  description: 'Fresh bagel, roll, or your preferred bread with cream cheese.' },
  { category: 'Breakfast', title: 'Eggs Sandwich',                           price:  2.99, image_url: '/images/menu/36.jpg',   description: 'Two grilled eggs with vegetable salad in your choice of bread with the sauce of your choice.' },
  { category: 'Breakfast', title: 'Eggs & Cheese Sandwich',                  price:  3.99, image_url: '/images/menu/37.jpg',   description: 'Two grilled eggs and cheese with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Eggs & Halal Bacon Sandwich',             price:  5.99, image_url: '/images/menu/37b.jpg',  description: 'Two grilled eggs and cheese with halal cured sliced beef or turkey bacon in your choice of bread.' },
  { category: 'Breakfast', title: 'Eggs & Hot Dog Sandwich',                 price:  5.50, image_url: '/images/menu/39.jpg',   description: 'Two grilled eggs and pieces of beef hot dog with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Eggs & Sausage Sandwich',                 price:  6.99, image_url: '/images/menu/40.jpg',   description: 'Two grilled eggs and pieces of seasoned beef hot sausage with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Eggs & Cheese & Sausage Sandwich',        price:  6.99, image_url: '/images/menu/40.jpg',   description: 'Two grilled eggs, cheese, and seasoned beef sausage in your choice of bread.' },
  { category: 'Breakfast', title: 'Eggs & Italian Sausage Sandwich',         price:  8.99, image_url: '/images/menu/41.jpg',   description: 'Two grilled eggs and extra large seasoned beef Italian sausage wrapped in your choice of bread.' },
  { category: 'Breakfast', title: 'Tuna Fish Salad Sandwich',                price:  8.49, image_url: '/images/menu/0h2.jpg',  description: 'Special homemade fresh tuna fish with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Tuna Fish Egg Salad Melt Deluxe Sandwich',price:  9.99, image_url: '/images/menu/0h3.jpg',  description: 'Grilled eggs over homemade fresh tuna fish with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Tuna Fish Salad over Turkey Sandwich',    price: 10.99, image_url: '/images/menu/0h4.jpg',  description: 'Bold Salsalito turkey breast over homemade fresh tuna fish with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Turkey Sandwich',                         price:  8.99, image_url: '/images/menu/0h5.jpg',  description: 'Bold Salsalito turkey breast with vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Turkey with Halal Bacon Sandwich',        price:  8.99, image_url: '/images/menu/0h6.jpg',  description: 'Turkey breast with halal cured sliced beef or turkey bacon and vegetable salad in your choice of bread.' },
  { category: 'Breakfast', title: 'Chopped Cheese Sandwich',                 price:  7.99, image_url: '/images/menu/35c.jpg',  description: 'Chopped grilled halal beef berger with American cheese in a hero with the sauce of your choice.' },
  { category: 'Breakfast', title: 'Halal Bacon Sandwich',                    price:  5.99, image_url: '/images/menu/35d.jpg',  description: 'Halal cured sliced beef or turkey bacon with or without American cheese in your choice of bread.' },
  { category: 'Breakfast', title: 'Halal Bacon and Sausage Sandwich',        price:  7.99, image_url: '/images/menu/35e.jpg',  description: 'Halal cured sliced beef or turkey bacon with pieces of seasoned beef sausage in your choice of bread.' },
  { category: 'Breakfast', title: 'Eggs & Cheese & Salad Plate',             price:  5.99, image_url: '/images/menu/20.jpg',   description: 'Two grilled eggs and cheese served with onion, green peppers, lettuce, tomatoes, and cucumber.' },
  { category: 'Breakfast', title: 'Eggs & Beef Berger & Salad Plate',        price:  8.99, image_url: '/images/menu/21.jpg',   description: 'Two grilled eggs and beef berger served with vegetable salad and the sauce of your choice.' },
  { category: 'Breakfast', title: 'Eggs & Hot Dog & Salad Plate',            price:  7.99, image_url: '/images/menu/22.jpg',   description: 'Two grilled eggs with pieces of beef hot dog served with vegetable salad.' },
  { category: 'Breakfast', title: 'Halal Bacon and Sausage Salad Plate',     price:  8.99, image_url: '/images/menu/22b.jpg',  description: 'Two grilled eggs and halal cured sliced beef or turkey bacon served with vegetable salad.' },
  { category: 'Breakfast', title: 'Eggs & Hot Sausage & Salad Plate',        price:  8.49, image_url: '/images/menu/23.jpg',   description: 'Two grilled eggs with pieces of beef hot sausage served with vegetable salad.' },
  { category: 'Breakfast', title: 'Eggs & Italian Sausage & Salad Plate',    price:  9.99, image_url: '/images/menu/24.jpg',   description: 'Two grilled eggs with pieces of large beef Italian sausage served with vegetable salad.' },
  { category: 'Breakfast', title: 'Donut',                                   price:  1.99, image_url: '/images/menu/49d.jpg',  description: 'Fresh baked donut of your choice from a variety of flavors.' },
  { category: 'Breakfast', title: 'Dozen Donuts',                            price: 13.99, image_url: '/images/menu/49d2.jpg', description: 'A mix of 12 fresh baked donuts.' },
  { category: 'Breakfast', title: 'Croissant',                               price:  2.49, image_url: '/images/menu/49e.jpg',  description: 'Fresh baked today croissant.' },
  { category: 'Breakfast', title: 'Muffin',                                  price:  2.99, image_url: '/images/menu/49f.jpg',  description: 'Fresh baked muffin of your choice.' },
  { category: 'Breakfast', title: 'Danish',                                  price:  2.99, image_url: '/images/menu/49g.jpg',  description: 'Fresh baked Danish of your choice — cheese or cinnamon.' },
  { category: 'Breakfast', title: 'Apple Turnover',                          price:  2.99, image_url: '/images/menu/49h.jpg',  description: 'Pastry dessert filled with sweetened apples, freshly baked today.' },

  // ── Platter ──────────────────────────────────────────────────────────────
  { category: 'Platter', title: 'Chicken over Rice',                         price:  9.99, image_url: '/images/menu/1.jpg',    description: 'Grilled chicken chunks over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', title: 'Chicken Salad',                             price:  9.99, image_url: '/images/menu/2.jpg',    description: 'Grilled chicken chunks with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', title: 'Chicken Fries',                             price:  9.99, image_url: '/images/menu/2.jpg',    description: 'Grilled chicken chunks with special French seasoned fries and the sauce of your choice.' },
  { category: 'Platter', title: 'Lamb over Rice',                            price:  9.99, image_url: '/images/menu/3.jpg',    description: 'Lamb gyro slices off the rotating gyro machine over rice with vegetable salad and sauce.' },
  { category: 'Platter', title: 'Lamb Salad',                                price:  9.99, image_url: '/images/menu/4.jpg',    description: 'Lamb gyro slices with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', title: 'Lamb Fries',                                price:  9.99, image_url: '/images/menu/4.jpg',    description: 'Lamb gyro slices with special French seasoned fries and the sauce of your choice.' },
  { category: 'Platter', title: 'Combo (Lamb & Chicken) over Rice',          price: 10.99, image_url: '/images/menu/5.jpg',    description: 'Grilled chicken and lamb gyro over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', title: 'Combo (Lamb & Chicken) Salad',              price: 10.99, image_url: '/images/menu/9.jpg',    description: 'Grilled chicken and lamb gyro with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', title: 'Combo (Lamb & Chicken) Fries',              price: 10.99, image_url: '/images/menu/5.jpg',    description: 'Grilled chicken and lamb gyro with special French seasoned fries and the sauce of your choice.' },
  { category: 'Platter', title: 'Half Chicken over Rice',                    price: 14.99, image_url: '/images/menu/6b.jpg',   description: 'Grilled specially seasoned half chicken on the bone over rice with vegetable salad.' },
  { category: 'Platter', title: 'Half Grilled Chicken Salad',                price: 14.99, image_url: '/images/menu/6c.jpg',   description: 'Grilled specially seasoned half chicken on the bone served with vegetable salad.' },
  { category: 'Platter', title: 'Jumbo Shrimp over Rice',                    price: 10.99, image_url: '/images/menu/7b.jpg',   description: 'Fried fresh jumbo shrimp with special charcoal flavor over rice with vegetable salad.' },
  { category: 'Platter', title: 'Jumbo Shrimp Fries',                        price: 10.99, image_url: '/images/menu/7c.jpg',   description: 'Six fried fresh jumbo shrimp with special French fries and the sauce of your choice.' },
  { category: 'Platter', title: 'Jumbo Shrimp Salad',                        price: 10.99, image_url: '/images/menu/7d.jpg',   description: 'Six grilled fresh jumbo shrimp with lettuce, tomatoes, cucumber, onions, green peppers, and sauce.' },
  { category: 'Platter', title: 'Fish over Rice',                            price: 10.99, image_url: '/images/menu/7e.jpg',   description: 'Large specially breaded white fillet fish cutlets over rice with vegetable salad.' },
  { category: 'Platter', title: 'Fish over Salad',                           price: 10.99, image_url: '/images/menu/7f.jpg',   description: 'Large specially breaded white fillet fish cutlets with lettuce, tomatoes, cucumber, and sauce.' },
  { category: 'Platter', title: 'Fish with Fries',                           price: 10.99, image_url: '/images/menu/7f.jpg',   description: 'Large specially breaded white fillet fish cutlets with home seasoned fries and sauce.' },
  { category: 'Platter', title: 'Plain Chicken Wings over Rice',             price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six fresh fried wings over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', title: 'Buffalo Chicken Wings over Rice',           price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six spicy fried wings in special buffalo sauce over rice with vegetable salad.' },
  { category: 'Platter', title: 'BBQ Chicken Wings over Rice',               price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six BBQ fried wings in special BBQ sauce over rice with vegetable salad.' },
  { category: 'Platter', title: 'Plain Chicken Wings with Salad',            price:  9.99, image_url: '/images/menu/8.jpg',    description: 'Six fresh fried wings served with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', title: 'Buffalo Chicken Wings with Salad',          price:  9.99, image_url: '/images/menu/12.jpg',   description: 'Six spicy fried wings in special buffalo sauce served with vegetable salad.' },
  { category: 'Platter', title: 'BBQ Chicken Wings with Salad',              price:  9.99, image_url: '/images/menu/13.jpg',   description: 'Six BBQ fried wings in special BBQ sauce served with vegetable salad.' },
  { category: 'Platter', title: 'Falafel over Rice',                         price:  9.99, image_url: '/images/menu/14.jpg',   description: 'Eight homemade crispy fresh falafel over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', title: 'Falafel Salad',                             price:  8.99, image_url: '/images/menu/15.jpg',   description: 'Eight homemade crispy fresh falafel with lettuce, tomatoes, cucumber, and the sauce of your choice.' },
  { category: 'Platter', title: 'Empanadas over Rice and Salad',             price: 10.99, image_url: '/images/menu/15b.jpg',  description: 'Two baby fried beef potato patties in Latin style served with rice and vegetable salad.' },
  { category: 'Platter', title: 'Tuna Fish Salad Plate',                     price:  8.49, image_url: '/images/menu/15c.jpg',  description: 'Special homemade fresh tuna fish with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', title: 'Tuna Fish Egg Salad Melt Deluxe Plate',    price:  9.99, image_url: '/images/menu/15d.jpg',  description: 'Grilled eggs over homemade fresh tuna fish with vegetable salad and sauce.' },
  { category: 'Platter', title: 'Turkey over Rice',                          price: 10.99, image_url: '/images/menu/15e.jpg',  description: 'Bold Salsalito turkey breast over rice with vegetable salad and the sauce of your choice.' },
  { category: 'Platter', title: 'Turkey with Halal Bacon Plate',             price: 10.99, image_url: '/images/menu/15f.jpg',  description: 'Turkey breast with halal cured beef or turkey bacon served with vegetable salad.' },
  { category: 'Platter', title: 'Italian Sausage over Rice',                 price:  9.99, image_url: '/images/menu/16.jpg',   description: 'Extra large grilled beef Italian sausage over rice with vegetable salad.' },
  { category: 'Platter', title: 'Italian Sausage Salad',                     price:  9.99, image_url: '/images/menu/17.jpg',   description: 'Extra large grilled beef Italian sausage with lettuce, tomatoes, cucumber, and sauce.' },
  { category: 'Platter', title: 'Double Chicken Shish Kebab over Rice',      price:  9.99, image_url: '/images/menu/18.jpg',   description: 'Charcoal grilled chicken chunks off two shish kebab sticks over rice with vegetable salad.' },
  { category: 'Platter', title: 'Double Chicken Shish Salad',                price:  9.99, image_url: '/images/menu/19.jpg',   description: 'Charcoal grilled chicken chunks off two shish kebab sticks served with vegetable salad.' },
  { category: 'Platter', title: 'Double Beef Shish Kebab over Rice',         price:  9.99, image_url: '/images/menu/18b.jpg',  description: 'Charcoal grilled beef chunks off two shish kebab sticks over rice with vegetable salad.' },
  { category: 'Platter', title: 'Double Beef Shish Salad',                   price:  9.99, image_url: '/images/menu/19b.jpg',  description: 'Charcoal grilled beef chunks off two shish kebab sticks served with vegetable salad.' },

  // ── Sandwich ─────────────────────────────────────────────────────────────
  { category: 'Sandwich', title: 'Chicken Gyro',                             price:  7.99, image_url: '/images/menu/25.jpg',   description: 'Grilled chicken chunks with vegetable salad wrapped in pita bread with the sauce of your choice.' },
  { category: 'Sandwich', title: 'Lamb Gyro',                                price:  7.99, image_url: '/images/menu/26.jpg',   description: 'Lamb gyro slices off the rotating gyro machine with vegetable salad wrapped in pita bread.' },
  { category: 'Sandwich', title: 'Combo (Lamb & Chicken) Sandwich',          price:  8.99, image_url: '/images/menu/27.jpg',   description: 'Grilled chicken and lamb gyro with vegetable salad wrapped in pita bread with sauce.' },
  { category: 'Sandwich', title: 'Jumbo Shrimp Sandwich',                    price:  8.99, image_url: '/images/menu/27b.jpg',  description: 'Grilled fresh jumbo shrimp with special charcoal flavor in your choice of bread and sauce.' },
  { category: 'Sandwich', title: 'Fish Fillet Sandwich',                     price:  7.99, image_url: '/images/menu/27c.jpg',  description: 'Large specially breaded white fillet fish in your choice of bread and sauce.' },
  { category: 'Sandwich', title: 'Falafel Sandwich',                         price:  7.99, image_url: '/images/menu/28.jpg',   description: 'Eight homemade crispy fresh falafel wrapped in pita bread with the sauce of your choice.' },
  { category: 'Sandwich', title: 'Philly Cheese Steak',                      price:  6.99, image_url: '/images/menu/29.jpg',   description: 'Fresh Philly steak with vegetable salad wrapped in pita bread with the sauce of your choice.' },
  { category: 'Sandwich', title: 'Hot Dog',                                  price:  2.50, image_url: '/images/menu/30.jpg',   description: 'Grilled beef hot dog in a bun with the sauce of your choice.' },
  { category: 'Sandwich', title: 'Hot Sausage',                              price:  3.50, image_url: '/images/menu/31.jpg',   description: 'Grilled seasoned beef hot sausage in a bun with the sauce of your choice.' },
  { category: 'Sandwich', title: 'Italian Sausage Sandwich',                 price:  6.99, image_url: '/images/menu/32.jpg',   description: 'Extra large seasoned beef Italian hot sausage with vegetable salad wrapped in pita bread.' },
  { category: 'Sandwich', title: 'Chicken Shish Kebab Sandwich',             price:  5.99, image_url: '/images/menu/33.jpg',   description: 'Charcoal grilled chicken chunks off a shish kebab stick with vegetable salad in pita bread.' },
  { category: 'Sandwich', title: 'Beef Shish Kebab Sandwich',                price:  6.99, image_url: '/images/menu/34b.jpg',  description: 'Charcoal grilled beef chunks off a shish kebab stick with vegetable salad in pita bread.' },

  // ── Bergers ──────────────────────────────────────────────────────────────
  { category: 'Bergers', title: 'Beef Berger',                               price:  6.49, image_url: '/images/menu/35.jpg',   description: 'Grilled halal juicy beef berger with vegetable salad in a sandwich with the sauce of your choice.' },
  { category: 'Bergers', title: 'Chicken Berger',                            price:  6.49, image_url: '/images/menu/35a.jpg',  description: 'Grilled halal juicy chicken berger with vegetable salad in a sandwich with the sauce of your choice.' },
  { category: 'Bergers', title: 'Cheese Beef Berger',                        price:  6.99, image_url: '/images/menu/35b.jpg',  description: 'Grilled halal juicy beef berger with American cheese and vegetable salad.' },
  { category: 'Bergers', title: 'Cheese Chicken Berger',                     price:  6.99, image_url: '/images/menu/35b2.jpg', description: 'Grilled halal juicy chicken berger with American cheese and vegetable salad.' },
  { category: 'Bergers', title: 'Eggs & Beef Berger Sandwich',               price:  7.99, image_url: '/images/menu/38.jpg',   description: 'Two grilled eggs and beef berger with vegetable salad in your choice of bread.' },
  { category: 'Bergers', title: 'Eggs & Chicken Berger Sandwich',            price:  7.99, image_url: '/images/menu/38b.jpg',  description: 'Two grilled eggs and chicken berger with vegetable salad in your choice of bread.' },

  // ── Tacos ─────────────────────────────────────────────────────────────────
  { category: 'Tacos', title: 'Chicken Taco',                                price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with halal grilled chicken chunks and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', title: 'Beef Taco',                                   price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with halal ground beef and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', title: 'Lamb Taco',                                   price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with lamb gyro cuts and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', title: 'Beef Steak Taco',                             price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with beef steak chunks and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', title: 'Shrimp Taco',                                 price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with shrimp and mixed vegetables with your choice of sauce.' },
  { category: 'Tacos', title: 'Hot Dog Taco',                                price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with a halal grilled beef hot dog and mixed vegetables.' },
  { category: 'Tacos', title: 'Sausage Taco',                                price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with halal seasoned beef sausage pieces and mixed vegetables.' },
  { category: 'Tacos', title: 'Falafel Taco',                                price:  3.99, image_url: '/images/menu/41.jpg',   description: 'Fried folded tortilla with homemade crispy fresh falafel and mixed vegetables.' },

  // ── Extras ────────────────────────────────────────────────────────────────
  { category: 'Extras', title: 'Mix Green Salad',                            price:  5.99, image_url: '/images/menu/7.jpg',    description: 'Fresh large plate with lettuce, tomatoes, cucumber, onions, green peppers, and the sauce of your choice.' },
  { category: 'Extras', title: 'Chicken Shish Kebab Stick',                  price:  4.99, image_url: '/images/menu/42.jpg',   description: 'Charcoal grilled chicken chunks on a shish kebab stick with the sauce of your choice.' },
  { category: 'Extras', title: 'Beef Shish Kebab Stick',                     price:  5.99, image_url: '/images/menu/42b.jpg',  description: 'Charcoal grilled beef chunks on a shish kebab stick with the sauce of your choice.' },
  { category: 'Extras', title: 'Pita Bread with White Sauce',                price:  1.50, image_url: '/images/menu/43.jpg',   description: 'Pita bread heated and cut on the grill with special white sauce and garlic.' },
  { category: 'Extras', title: 'French Fries',                               price:  2.99, image_url: '/images/menu/44.jpg',   description: 'Fresh French fries with the sauce of your choice.' },
  { category: 'Extras', title: 'French Fries Plate (Large)',                 price:  4.99, image_url: '/images/menu/45.jpg',   description: 'A large plate of fresh French fries with the sauce of your choice.' },
  { category: 'Extras', title: 'Rice Plate',                                 price:  3.49, image_url: '/images/menu/46.jpg',   description: 'Special seasoned rice with the sauce of your choice.' },
  { category: 'Extras', title: 'Double Rice Plate',                          price:  4.99, image_url: '/images/menu/47.jpg',   description: 'A large plate of special seasoned rice with the sauce of your choice.' },
  { category: 'Extras', title: '4 Falafel with White Sauce',                 price:  3.50, image_url: '/images/menu/48.jpg',   description: 'Four homemade crispy fresh falafel with special white sauce.' },
  { category: 'Extras', title: 'Side Salad Mix Plate',                       price:  5.99, image_url: '/images/menu/48b.jpg',  description: 'Fresh side plate with lettuce, tomatoes, cucumber, onions, green peppers, and sauce.' },
  { category: 'Extras', title: 'Samosa',                                     price:  1.00, image_url: '/images/menu/49.jpg',   description: 'Fried pastry with a savory stuffing (one piece).' },
  { category: 'Extras', title: 'Empanada',                                   price:  3.99, image_url: '/images/menu/49a.jpg',  description: 'Baby fried beef potato pattie in Latin style with the sauce of your choice.' },
  { category: 'Extras', title: 'Mozzarella Sticks',                          price:  6.99, image_url: '/images/menu/49b.jpg',  description: 'Six homemade fried mozzarella cheese sticks served with the sauce of your choice.' },
  { category: 'Extras', title: 'Onion Rings',                                price:  4.99, image_url: '/images/menu/44.jpg',   description: 'Homemade onion rings, fried super crispy and delicious.' },
  { category: 'Extras', title: 'Chocolate Cake',                             price:  3.99, image_url: '/images/menu/49i.jpg',  description: 'Fresh prepared cake slice with sweet and savory taste.' },

  // ── Drinks ───────────────────────────────────────────────────────────────
  { category: 'Drinks', title: 'Canned Soda',                                price:  1.49, image_url: '/images/menu/50.jpg',   description: 'Can of soda — Pepsi, Diet Pepsi, Coke, Orange, Sprite, Ginger Ale, or Iced Tea.' },
  { category: 'Drinks', title: '2-Liter Pepsi',                              price:  2.99, image_url: '/images/menu/51.jpg',   description: 'Two-liter bottle of Pepsi.' },
  { category: 'Drinks', title: 'Bottled Water',                              price:  1.49, image_url: '/images/menu/52.jpg',   description: 'Poland Spring bottle of water, 16.9 fl oz.' },
  { category: 'Drinks', title: 'Snapple',                                    price:  2.99, image_url: '/images/menu/53.jpg',   description: 'Snapple juice bottle — Apple, Lemon Tea, or Peach.' },
  { category: 'Drinks', title: 'Gatorade',                                   price:  2.99, image_url: '/images/menu/53.jpg',   description: 'Gatorade thirst quencher — Lemon Lime, Orange, Fruit Punch, or Berry.' },
  { category: 'Drinks', title: 'Orange Juice',                               price:  2.99, image_url: '/images/menu/55.jpg',   description: 'Fresh orange juice.' },
  { category: 'Drinks', title: 'Apple Juice',                                price:  2.99, image_url: '/images/menu/56.jpg',   description: 'Fresh apple juice.' },
  { category: 'Drinks', title: 'Cranberry Juice',                            price:  2.99, image_url: '/images/menu/57.jpg',   description: 'Fresh cranberry juice.' },
  { category: 'Drinks', title: 'Pineapple Juice',                            price:  2.99, image_url: '/images/menu/58.jpg',   description: 'Fresh pineapple juice.' },
  { category: 'Drinks', title: 'Mix Juice',                                  price:  3.99, image_url: '/images/menu/59.jpg',   description: 'Mix of any two or more fresh juices.' },
  { category: 'Drinks', title: 'Iced Coffee',                                price:  2.99, image_url: '/images/menu/60.jpg',   description: 'Colombian coffee with your choice of flavor, sugar, and ice.' },
  { category: 'Drinks', title: 'Regular Hot Coffee',                         price:  2.49, image_url: '/images/menu/61.jpg',   description: 'Colombian coffee with your choice of flavor and sugar.' },
  { category: 'Drinks', title: 'Hot Chocolate',                              price:  2.49, image_url: '/images/menu/62.jpg',   description: 'Homemade hot chocolate with your choice of sugar.' },
  { category: 'Drinks', title: 'Tea',                                        price:  2.49, image_url: '/images/menu/63.jpg',   description: 'Homemade tea with your choice of kind and sugar.' },

  // ── Family Tray ───────────────────────────────────────────────────────────
  { category: 'Family Tray', title: 'Chicken over Rice Family Tray',         price: 31.99, image_url: '/images/menu/64.jpg',   description: 'Grilled chicken over rice with vegetable salad and sauces. Serves 4.' },
  { category: 'Family Tray', title: 'Lamb over Rice Family Tray',            price: 31.99, image_url: '/images/menu/65.jpg',   description: 'Lamb gyro over rice with vegetable salad and sauces. Serves 4.' },
  { category: 'Family Tray', title: 'Combo (Lamb & Chicken) Family Tray',   price: 34.99, image_url: '/images/menu/66.jpg',   description: 'Chicken and lamb gyro over rice with vegetable salad. Serves 4.' },
  { category: 'Family Tray', title: 'Whole Chicken over Rice',               price: 24.99, image_url: '/images/menu/66b.jpg',  description: 'Whole grilled specially seasoned chicken (cut in four pieces) over rice with vegetable salad.' },
  { category: 'Family Tray', title: 'Jumbo Shrimp Family Tray',              price: 36.99, image_url: '/images/menu/67.jpg',   description: 'Jumbo shrimp over rice with vegetable salad. Serves 4.' },
  { category: 'Family Tray', title: 'Fish over Rice Family Tray',            price: 36.99, image_url: '/images/menu/68.jpg',   description: 'Eight breaded fish cutlets over rice with vegetable salad. Serves 4.' },
  { category: 'Family Tray', title: 'Chicken Wings Family Tray',             price: 31.99, image_url: '/images/menu/69.jpg',   description: '24 fried wings over rice with vegetable salad — Buffalo, plain, or BBQ. Serves 4.' },
  { category: 'Family Tray', title: 'Eggs & Hot Sausage & Salad Family Tray',price: 29.99, image_url: '/images/menu/70.jpg',   description: 'Six grilled eggs with beef hot sausage and vegetable salad. Serves 4.' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure all required categories exist (adds new ones, leaves existing untouched)
    const neededCategories = [...new Set(ITEMS.map(i => i.category))];
    for (const name of neededCategories) {
      const existing = await client.query(
        `SELECT id FROM categories WHERE LOWER(name) = LOWER($1)`, [name]
      );
      if (existing.rows.length === 0) {
        await client.query(`INSERT INTO categories (name) VALUES ($1)`, [name]);
      }
    }

    // Build category name → id map
    const { rows: catRows } = await client.query('SELECT id, name FROM categories');
    const catMap = {};
    catRows.forEach(r => { catMap[r.name.toLowerCase()] = r.id; });

    // Remove all existing menu items
    // (choice_groups, addon_groups, menu_item_locations cascade automatically)
    await client.query('DELETE FROM menu_items');
    console.log('✅ Cleared all existing menu items\n');

    let inserted = 0;
    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      const catId = catMap[item.category.toLowerCase()];
      if (!catId) {
        console.warn(`  ⚠️  No category found for "${item.category}" — skipping "${item.title}"`);
        continue;
      }
      await client.query(
        `INSERT INTO menu_items
           (title, description, price, partner_price, category_id, is_available, image_url, preference)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
        [item.title, item.description, item.price, pp(item.price), catId, item.image_url, i + 1]
      );
      inserted++;
      console.log(`  ✅ [${item.category.padEnd(14)}] ${item.title}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Done — ${inserted} items inserted across ${neededCategories.length} categories`);
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
