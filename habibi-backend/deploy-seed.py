#!/usr/bin/env python3
"""Run on server: python3 /tmp/deploy-seed.py"""
import subprocess, os, sys

env = dict(os.environ)
env_path = '/var/www/habibi/habibi-backend/.env'
for line in open(env_path):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env.setdefault(k.strip(), v.strip())

DB  = env.get('DB_NAME', 'habibi_db')
USR = env.get('DB_USER', 'postgres')
PWD = env.get('DB_PASSWORD', '')
env['PGPASSWORD'] = PWD

def q(s): return s.replace("'", "''")

ITEMS = [
  # ── BREAKFAST (32) ────────────────────────────────────────────────────────
  ('Breakfast','Cream Cheese Sandwich',2.99,'/images/menu/35f.jpg','Fresh bagel, roll, or preferred bread with cream cheese.'),
  ('Breakfast','Eggs Sandwich',2.99,'/images/menu/36.jpg','Two grilled eggs with vegetable salad in your choice of bread.'),
  ('Breakfast','Eggs & Cheese Sandwich',3.99,'/images/menu/37.jpg','Two grilled eggs and cheese with vegetable salad in your choice of bread.'),
  ('Breakfast','Eggs & Halal Bacon Sandwich',5.99,'/images/menu/37b.jpg','Two grilled eggs and halal cured sliced beef or turkey bacon in your choice of bread.'),
  ('Breakfast','Eggs & Beef Burger Sandwich',7.99,'/images/menu/38.jpg','Two grilled eggs and beef burger with vegetable salad in your choice of bread.'),
  ('Breakfast','Eggs & Hot Dog Sandwich',5.50,'/images/menu/39.jpg','Two grilled eggs and beef hot dog in your choice of bread.'),
  ('Breakfast','Eggs & Sausage Sandwich',6.99,'/images/menu/40.jpg','Two grilled eggs and seasoned beef sausage in your choice of bread.'),
  ('Breakfast','Eggs & Cheese & Sausage Sandwich',6.99,'/images/menu/40.jpg','Two grilled eggs, cheese, and sausage in your choice of bread.'),
  ('Breakfast','Eggs & Italian Sausage Sandwich',8.99,'/images/menu/41.jpg','Two grilled eggs and extra large beef Italian sausage in your choice of bread.'),
  ('Breakfast','Tuna Fish Salad Sandwich',8.49,'/images/menu/0h2.jpg','Homemade fresh tuna fish with vegetable salad in your choice of bread.'),
  ('Breakfast','Tuna Fish Egg Salad Melt Deluxe Sandwich',9.99,'/images/menu/0h3.jpg','Grilled eggs over fresh tuna fish with vegetable salad in your choice of bread.'),
  ('Breakfast','Tuna Fish Salad over Turkey Sandwich',10.99,'/images/menu/0h4.jpg','Turkey breast over fresh tuna fish with vegetable salad in your choice of bread.'),
  ('Breakfast','Turkey Sandwich',8.99,'/images/menu/0h5.jpg','Bold Salsalito turkey breast with vegetable salad in your choice of bread.'),
  ('Breakfast','Turkey with Halal Bacon Sandwich',8.99,'/images/menu/0h6.jpg','Turkey breast with halal cured sliced beef or turkey bacon in your choice of bread.'),
  ('Breakfast','Chopped Cheese Sandwich',7.99,'/images/menu/35c.jpg','Chopped grilled halal beef burger with American cheese in a hero.'),
  ('Breakfast','Halal Bacon Sandwich',5.99,'/images/menu/35d.jpg','Halal cured sliced beef or turkey bacon with or without cheese in your choice of bread.'),
  ('Breakfast','Halal Bacon and Sausage Sandwich',7.99,'/images/menu/35e.jpg','Halal cured sliced beef or turkey bacon with seasoned beef sausage in your choice of bread.'),
  ('Breakfast','Falafel Sandwich',7.99,'/images/menu/28.jpg','Homemade crispy fresh falafel wrapped in pita bread with the sauce of your choice.'),
  ('Breakfast','Falafel Salad Plate',8.99,'/images/menu/15.jpg','Homemade crispy fresh falafel with lettuce, tomatoes, cucumber, and sauce.'),
  ('Breakfast','Eggs & Cheese & Salad Plate',5.99,'/images/menu/20.jpg','Two grilled eggs and cheese with onion, peppers, lettuce, tomatoes, and cucumber.'),
  ('Breakfast','Eggs & Beef Burger & Salad Plate',8.99,'/images/menu/21.jpg','Two grilled eggs and beef burger served with vegetable salad.'),
  ('Breakfast','Eggs & Hot Dog & Salad Plate',7.99,'/images/menu/22.jpg','Two grilled eggs with beef hot dog served with vegetable salad.'),
  ('Breakfast','Halal Bacon and Sausage Salad Plate',8.99,'/images/menu/22b.jpg','Halal cured beef or turkey bacon with sausage and vegetable salad.'),
  ('Breakfast','Eggs & Hot Sausage & Salad Plate',8.49,'/images/menu/23.jpg','Two grilled eggs with beef hot sausage served with vegetable salad.'),
  ('Breakfast','Eggs & Italian Sausage & Salad Plate',9.99,'/images/menu/24.jpg','Two grilled eggs with large beef Italian sausage served with vegetable salad.'),
  ('Breakfast','Mix Green Salad Plate',5.99,'/images/menu/7.jpg','Fresh plate with lettuce, tomatoes, cucumber, onions, green peppers, and sauce.'),
  ('Breakfast','Donut',1.99,'/images/menu/49d.jpg','Fresh baked donut of your choice.'),
  ('Breakfast','Dozen Donuts',13.99,'/images/menu/49d2.jpg','A mix of 12 fresh baked donuts.'),
  ('Breakfast','Croissant',2.49,'/images/menu/49e.jpg','Fresh baked today croissant.'),
  ('Breakfast','Muffin',2.99,'/images/menu/49f.jpg','Fresh baked muffin of your choice.'),
  ('Breakfast','Danish',2.99,'/images/menu/49g.jpg','Fresh baked Danish of your choice, cheese or cinnamon.'),
  ('Breakfast','Apple Turnover',2.99,'/images/menu/49h.jpg','Pastry filled with sweetened apples, freshly baked today.'),
  # ── PLATTER (46) ──────────────────────────────────────────────────────────
  ('Platter','Chicken over Rice',9.99,'/images/menu/1.jpg','Grilled chicken over rice with vegetable salad and the sauce of your choice.'),
  ('Platter','Chicken Salad',9.99,'/images/menu/2.jpg','Grilled chicken with lettuce, tomatoes, cucumber, and the sauce of your choice.'),
  ('Platter','Chicken Fries',9.99,'/images/menu/2.jpg','Grilled chicken with special French seasoned fries and the sauce of your choice.'),
  ('Platter','Lamb over Rice',9.99,'/images/menu/3.jpg','Lamb gyro slices over rice with vegetable salad and the sauce of your choice.'),
  ('Platter','Lamb Salad',9.99,'/images/menu/4.jpg','Lamb gyro slices with lettuce, tomatoes, cucumber, and the sauce of your choice.'),
  ('Platter','Lamb Fries',9.99,'/images/menu/4.jpg','Lamb gyro slices with special French seasoned fries and the sauce of your choice.'),
  ('Platter','Combo (Lamb & Chicken) over Rice',10.99,'/images/menu/5.jpg','Grilled chicken and lamb gyro over rice with vegetable salad and sauce.'),
  ('Platter','Combo (Lamb & Chicken) Salad',10.99,'/images/menu/9.jpg','Grilled chicken and lamb gyro with lettuce, tomatoes, cucumber, and sauce.'),
  ('Platter','Combo (Lamb & Chicken) Fries',10.99,'/images/menu/5.jpg','Grilled chicken and lamb gyro with special French seasoned fries and sauce.'),
  ('Platter','Half Chicken over Rice',14.99,'/images/menu/6b.jpg','Grilled specially seasoned half chicken on the bone over rice with vegetable salad.'),
  ('Platter','Half Grilled Chicken Salad',14.99,'/images/menu/6c.jpg','Grilled specially seasoned half chicken on the bone with vegetable salad.'),
  ('Platter','Mix Green Salad',5.99,'/images/menu/7.jpg','Fresh plate with lettuce, tomatoes, cucumber, onions, green peppers, and sauce.'),
  ('Platter','Jumbo Shrimp over Rice',10.99,'/images/menu/7b.jpg','Fried fresh jumbo shrimp with special charcoal flavor over rice with vegetable salad.'),
  ('Platter','Jumbo Shrimp Fries',10.99,'/images/menu/7c.jpg','Six fried fresh jumbo shrimp with special French fries and your choice of sauce.'),
  ('Platter','Jumbo Shrimp Salad',10.99,'/images/menu/7d.jpg','Six grilled fresh jumbo shrimp with lettuce, tomatoes, cucumber, onions, and sauce.'),
  ('Platter','Fish over Rice',10.99,'/images/menu/7e.jpg','Large specially breaded white fillet fish cutlets over rice with vegetable salad.'),
  ('Platter','Fish over Salad',10.99,'/images/menu/7f.jpg','Large specially breaded white fillet fish cutlets with lettuce, tomatoes, and sauce.'),
  ('Platter','Fish with Fries',10.99,'/images/menu/7f.jpg','Large specially breaded white fillet fish cutlets with home seasoned fries and sauce.'),
  ('Platter','Plain Chicken Wings over Rice',9.99,'/images/menu/8.jpg','Six fresh fried wings over rice with vegetable salad and the sauce of your choice.'),
  ('Platter','Buffalo Chicken Wings over Rice',9.99,'/images/menu/8.jpg','Six spicy fried wings in special buffalo sauce over rice with vegetable salad.'),
  ('Platter','BBQ Chicken Wings over Rice',9.99,'/images/menu/8.jpg','Six BBQ fried wings in special BBQ sauce over rice with vegetable salad.'),
  ('Platter','Plain Chicken Wings with Salad',9.99,'/images/menu/8.jpg','Six fresh fried wings served with vegetable salad and the sauce of your choice.'),
  ('Platter','Buffalo Chicken Wings with Salad',9.99,'/images/menu/12.jpg','Six spicy fried wings in special buffalo sauce served with vegetable salad.'),
  ('Platter','BBQ Chicken Wings with Salad',9.99,'/images/menu/13.jpg','Six BBQ fried wings in special BBQ sauce served with vegetable salad.'),
  ('Platter','Plain Chicken Wings with Fries',9.99,'/images/menu/13.jpg','Six fresh fried wings served with special French fries and the sauce of your choice.'),
  ('Platter','Buffalo Chicken Wings with Fries',9.99,'/images/menu/12.jpg','Six spicy fried wings in special buffalo sauce served with French fries.'),
  ('Platter','BBQ Chicken Wings with Fries',9.99,'/images/menu/13.jpg','Six BBQ fried wings in special BBQ sauce served with French fries.'),
  ('Platter','Falafel over Rice',9.99,'/images/menu/14.jpg','Eight homemade crispy fresh falafel over rice with vegetable salad and sauce.'),
  ('Platter','Falafel Salad',8.99,'/images/menu/15.jpg','Eight homemade crispy fresh falafel with lettuce, tomatoes, cucumber, and sauce.'),
  ('Platter','Empanadas over Rice and Salad',10.99,'/images/menu/15b.jpg','Two baby fried beef potato patties in Latin style with rice and vegetable salad.'),
  ('Platter','Tuna Fish Salad Plate',8.49,'/images/menu/15c.jpg','Homemade fresh tuna fish with vegetable salad and the sauce of your choice.'),
  ('Platter','Tuna Fish Egg Salad Melt Deluxe Plate',9.99,'/images/menu/15d.jpg','Grilled eggs over fresh tuna fish with vegetable salad and sauce.'),
  ('Platter','Turkey over Rice',10.99,'/images/menu/15e.jpg','Bold Salsalito turkey breast over rice with vegetable salad and sauce.'),
  ('Platter','Turkey with Halal Bacon Plate',10.99,'/images/menu/15f.jpg','Turkey breast with halal cured beef or turkey bacon with vegetable salad.'),
  ('Platter','Italian Sausage over Rice',9.99,'/images/menu/16.jpg','Extra large grilled beef Italian sausage over rice with vegetable salad.'),
  ('Platter','Italian Sausage Salad',9.99,'/images/menu/17.jpg','Extra large grilled beef Italian sausage with lettuce, tomatoes, cucumber, and sauce.'),
  ('Platter','Double Chicken Shish Kebab over Rice',9.99,'/images/menu/18.jpg','Charcoal grilled chicken chunks off two shish kebab sticks over rice with vegetable salad.'),
  ('Platter','Double Chicken Shish Salad',9.99,'/images/menu/19.jpg','Charcoal grilled chicken chunks off two shish kebab sticks with vegetable salad.'),
  ('Platter','Double Beef Shish Kebab over Rice',9.99,'/images/menu/18b.jpg','Charcoal grilled beef chunks off two shish kebab sticks over rice with vegetable salad.'),
  ('Platter','Double Beef Shish Salad',9.99,'/images/menu/19b.jpg','Charcoal grilled beef chunks off two shish kebab sticks with vegetable salad.'),
  ('Platter','Eggs & Cheese & Salad',5.99,'/images/menu/20.jpg','Two grilled eggs and cheese with onion, peppers, lettuce, tomatoes, and cucumber.'),
  ('Platter','Eggs & Beef Burger & Salad',8.99,'/images/menu/21.jpg','Two grilled eggs and beef burger served with vegetable salad.'),
  ('Platter','Eggs & Hot Dog & Salad',7.99,'/images/menu/22.jpg','Two grilled eggs with beef hot dog served with vegetable salad.'),
  ('Platter','Halal Bacon and Sausage Salad',8.99,'/images/menu/22b.jpg','Halal cured beef or turkey bacon with sausage and vegetable salad.'),
  ('Platter','Eggs & Hot Sausage & Salad',8.49,'/images/menu/23.jpg','Two grilled eggs with beef hot sausage served with vegetable salad.'),
  ('Platter','Eggs & Italian Sausage & Salad',9.99,'/images/menu/24.jpg','Two grilled eggs with large beef Italian sausage served with vegetable salad.'),
  # ── SANDWICH (37) ─────────────────────────────────────────────────────────
  ('Sandwich','Chicken Gyro',7.99,'/images/menu/25.jpg','Grilled chicken with vegetable salad wrapped in pita bread with the sauce of your choice.'),
  ('Sandwich','Lamb Gyro',7.99,'/images/menu/26.jpg','Lamb gyro slices with vegetable salad wrapped in pita bread with the sauce of your choice.'),
  ('Sandwich','Combo (Lamb & Chicken) Sandwich',8.99,'/images/menu/27.jpg','Grilled chicken and lamb gyro with vegetable salad wrapped in pita bread with sauce.'),
  ('Sandwich','Jumbo Shrimp Sandwich',8.99,'/images/menu/27b.jpg','Grilled fresh jumbo shrimp with special charcoal flavor in your choice of bread and sauce.'),
  ('Sandwich','Fish Fillet Sandwich',7.99,'/images/menu/27c.jpg','Large specially breaded white fillet fish in your choice of bread and sauce.'),
  ('Sandwich','Falafel Sandwich',7.99,'/images/menu/28.jpg','Eight homemade crispy fresh falafel wrapped in pita bread with the sauce of your choice.'),
  ('Sandwich','Philly Cheese Steak',6.99,'/images/menu/29.jpg','Fresh Philly steak with vegetable salad wrapped in pita bread with the sauce of your choice.'),
  ('Sandwich','Hot Dog',2.50,'/images/menu/30.jpg','Grilled beef hot dog in a bun with the sauce of your choice.'),
  ('Sandwich','Hot Sausage',3.50,'/images/menu/31.jpg','Grilled seasoned beef hot sausage in a bun with the sauce of your choice.'),
  ('Sandwich','Italian Sausage Sandwich',6.99,'/images/menu/32.jpg','Extra large seasoned beef Italian hot sausage with vegetable salad wrapped in pita bread.'),
  ('Sandwich','Chicken Shish Kebab Sandwich',5.99,'/images/menu/33.jpg','Charcoal grilled chicken chunks off a shish kebab stick with vegetable salad in pita bread.'),
  ('Sandwich','Double Chicken Shish Kebab Sandwich',8.99,'/images/menu/18.jpg','Charcoal grilled chicken chunks off two shish kebab sticks with vegetable salad in pita bread.'),
  ('Sandwich','Beef Shish Kebab Sandwich',6.99,'/images/menu/34b.jpg','Charcoal grilled beef chunks off a shish kebab stick with vegetable salad in pita bread.'),
  ('Sandwich','Double Beef Shish Kebab Sandwich',9.99,'/images/menu/18b.jpg','Charcoal grilled beef chunks off two shish kebab sticks with vegetable salad in pita bread.'),
  ('Sandwich','Beef Burger',6.49,'/images/menu/35.jpg','Grilled halal juicy beef burger with vegetable salad and the sauce of your choice.'),
  ('Sandwich','Chicken Burger',6.49,'/images/menu/35a.jpg','Grilled halal juicy chicken burger with vegetable salad and the sauce of your choice.'),
  ('Sandwich','Cheese Beef Burger',6.99,'/images/menu/35b.jpg','Grilled halal juicy beef burger with American cheese and vegetable salad.'),
  ('Sandwich','Cheese Chicken Burger',6.99,'/images/menu/35b2.jpg','Grilled halal juicy chicken burger with American cheese and vegetable salad.'),
  ('Sandwich','Chopped Cheese Sandwich',7.99,'/images/menu/35c.jpg','Chopped grilled halal beef burger with American cheese in a hero.'),
  ('Sandwich','Halal Bacon Sandwich',5.99,'/images/menu/35d.jpg','Halal cured sliced beef or turkey bacon with or without cheese in your choice of bread.'),
  ('Sandwich','Halal Bacon and Sausage Sandwich',7.99,'/images/menu/35e.jpg','Halal cured sliced beef or turkey bacon with seasoned beef sausage in your choice of bread.'),
  ('Sandwich','Tuna Fish Salad Sandwich',8.49,'/images/menu/0h2.jpg','Homemade fresh tuna fish with vegetable salad in your choice of bread.'),
  ('Sandwich','Tuna Fish Egg Salad Melt Deluxe Sandwich',9.99,'/images/menu/0h3.jpg','Grilled eggs over fresh tuna fish with vegetable salad in your choice of bread.'),
  ('Sandwich','Tuna Fish Salad over Turkey Sandwich',10.99,'/images/menu/0h4.jpg','Turkey breast over fresh tuna fish with vegetable salad in your choice of bread.'),
  ('Sandwich','Turkey Sandwich',8.99,'/images/menu/0h5.jpg','Bold Salsalito turkey breast with vegetable salad in your choice of bread.'),
  ('Sandwich','Turkey with Halal Bacon Sandwich',8.99,'/images/menu/0h6.jpg','Turkey breast with halal cured sliced beef or turkey bacon in your choice of bread.'),
  ('Sandwich','Bagel / Roll with Cream Cheese',2.99,'/images/menu/35f.jpg','Fresh bagel or roll with cream cheese.'),
  ('Sandwich','Eggs Sandwich',2.99,'/images/menu/36.jpg','Two grilled eggs in your choice of bread.'),
  ('Sandwich','Cream Cheese Sandwich',2.99,'/images/menu/35f.jpg','Fresh bagel, roll, or preferred bread with cream cheese.'),
  ('Sandwich','Eggs & Cheese Sandwich',3.99,'/images/menu/37.jpg','Two grilled eggs and cheese in your choice of bread.'),
  ('Sandwich','Eggs & Halal Bacon Sandwich',5.99,'/images/menu/37b.jpg','Two grilled eggs and halal cured sliced beef or turkey bacon in your choice of bread.'),
  ('Sandwich','Eggs & Beef Burger Sandwich',7.99,'/images/menu/38.jpg','Two grilled eggs and beef burger with vegetable salad in your choice of bread.'),
  ('Sandwich','Eggs & Hot Dog Sandwich',5.50,'/images/menu/39.jpg','Two grilled eggs and beef hot dog in your choice of bread.'),
  ('Sandwich','Eggs & Sausage Sandwich',6.99,'/images/menu/40.jpg','Two grilled eggs and seasoned beef sausage in your choice of bread.'),
  ('Sandwich','Eggs & Cheese & Sausage Sandwich',6.99,'/images/menu/40.jpg','Two grilled eggs, cheese, and sausage in your choice of bread.'),
  ('Sandwich','Eggs & Italian Sausage Sandwich',8.99,'/images/menu/41.jpg','Two grilled eggs and extra large beef Italian sausage in your choice of bread.'),
  ('Sandwich','Eggs Sandwich (Bagel / Roll / Croissant / Pita)',2.99,'/images/menu/36.jpg','Two grilled eggs in your choice of bagel, roll, croissant, or pita bread.'),
  # ── BURGERS (13) ──────────────────────────────────────────────────────────
  ('Burgers','Beef Burger',6.49,'/images/menu/35.jpg','Grilled halal juicy beef burger with vegetable salad and the sauce of your choice.'),
  ('Burgers','Beef Burger Deluxe',6.49,'/images/menu/35.jpg','Grilled halal juicy beef burger with lettuce, tomatoes, onions, and special sauce.'),
  ('Burgers','Double Beef Burger',6.49,'/images/menu/35.jpg','Two grilled halal juicy beef burgers with vegetable salad and the sauce of your choice.'),
  ('Burgers','Double Beef Burger Deluxe',6.49,'/images/menu/35.jpg','Two grilled halal juicy beef burgers with lettuce, tomatoes, onions, and special sauce.'),
  ('Burgers','Chicken Burger',6.49,'/images/menu/35a.jpg','Grilled halal juicy chicken burger with vegetable salad and the sauce of your choice.'),
  ('Burgers','Chicken Burger Deluxe',6.49,'/images/menu/35a.jpg','Grilled halal juicy chicken burger with lettuce, tomatoes, onions, and special sauce.'),
  ('Burgers','Double Chicken Burger',6.49,'/images/menu/35a.jpg','Two grilled halal juicy chicken burgers with vegetable salad and the sauce of your choice.'),
  ('Burgers','Cheese Beef Burger',6.99,'/images/menu/35b.jpg','Grilled halal juicy beef burger with American cheese and vegetable salad.'),
  ('Burgers','Cheese Chicken Burger',6.99,'/images/menu/35b2.jpg','Grilled halal juicy chicken burger with American cheese and vegetable salad.'),
  ('Burgers','Eggs & Beef Burger Sandwich',7.99,'/images/menu/38.jpg','Two grilled eggs and beef burger with vegetable salad in your choice of bread.'),
  ('Burgers','Eggs & Chicken Burger Sandwich',7.99,'/images/menu/38b.jpg','Two grilled eggs and chicken burger with vegetable salad in your choice of bread.'),
  ('Burgers','Eggs & Beef Burger & Salad Plate',8.99,'/images/menu/21.jpg','Two grilled eggs and beef burger served with vegetable salad.'),
  ('Burgers','Eggs & Beef Burger & Salad',8.99,'/images/menu/21.jpg','Two grilled eggs and beef burger served with a fresh mix vegetable salad.'),
  # ── TACOS (8 at $3.99) ────────────────────────────────────────────────────
  ('Tacos','Chicken Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with halal grilled chicken chunks and mixed vegetables with sauce.'),
  ('Tacos','Beef Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with halal ground beef and mixed vegetables with your choice of sauce.'),
  ('Tacos','Lamb Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with lamb gyro cuts and mixed vegetables with your choice of sauce.'),
  ('Tacos','Beef Steak Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with beef steak chunks and mixed vegetables with your choice of sauce.'),
  ('Tacos','Shrimp Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with shrimp and mixed vegetables with your choice of sauce.'),
  ('Tacos','Hot Dog Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with a halal grilled beef hot dog and mixed vegetables.'),
  ('Tacos','Sausage Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with halal seasoned beef sausage pieces and mixed vegetables.'),
  ('Tacos','Falafel Taco',3.99,'/images/menu/41.jpg','Fried folded tortilla with homemade crispy fresh falafel and mixed vegetables.'),
  # ── EXTRAS (21) ───────────────────────────────────────────────────────────
  ('Extras','Habibi Jerk Plate',4.99,'/images/menu/42.jpg','Habibi special jerk seasoned plate served with the sauce of your choice.'),
  ('Extras','Chicken Shish Kebab Stick',4.99,'/images/menu/42.jpg','Charcoal grilled chicken chunks on a shish kebab stick with the sauce of your choice.'),
  ('Extras','Beef Shish Kebab Stick',5.99,'/images/menu/42b.jpg','Charcoal grilled beef chunks on a shish kebab stick with the sauce of your choice.'),
  ('Extras','Pita Bread with White Sauce and Garlic',1.50,'/images/menu/43.jpg','Pita bread heated and cut on the grill with special white sauce and garlic.'),
  ('Extras','French Fries',2.99,'/images/menu/44.jpg','Fresh French fries with the sauce of your choice.'),
  ('Extras','French Fries Plate (Large)',4.99,'/images/menu/45.jpg','A large plate of fresh French fries with the sauce of your choice.'),
  ('Extras','Rice Plate',3.49,'/images/menu/46.jpg','Special seasoned rice with the sauce of your choice.'),
  ('Extras','Double Rice Plate',4.99,'/images/menu/47.jpg','A large plate of special seasoned rice with the sauce of your choice.'),
  ('Extras','4 Falafel with White Sauce',3.50,'/images/menu/48.jpg','Four homemade crispy fresh falafel with special white sauce.'),
  ('Extras','Side Salad Mix Plate',5.99,'/images/menu/48b.jpg','Fresh side plate with lettuce, tomatoes, cucumber, onions, green peppers, and sauce.'),
  ('Extras','Samosa',1.00,'/images/menu/49.jpg','Fried pastry with a savory stuffing (one piece).'),
  ('Extras','Empanada',3.99,'/images/menu/49a.jpg','Baby fried beef potato pattie in Latin style with the sauce of your choice.'),
  ('Extras','Mozzarella Sticks',6.99,'/images/menu/49b.jpg','Six homemade fried mozzarella cheese sticks served with the sauce of your choice.'),
  ('Extras','Onion Rings',4.99,'/images/menu/44.jpg','Homemade onion rings, fried super crispy and delicious.'),
  ('Extras','Donut',1.99,'/images/menu/49d.jpg','Fresh baked donut of your choice.'),
  ('Extras','Dozen Donuts',13.99,'/images/menu/49d2.jpg','A mix of 12 fresh baked donuts.'),
  ('Extras','Croissant',2.49,'/images/menu/49e.jpg','Fresh baked today croissant.'),
  ('Extras','Muffin',2.99,'/images/menu/49f.jpg','Fresh baked muffin of your choice.'),
  ('Extras','Danish',2.99,'/images/menu/49g.jpg','Fresh baked Danish of your choice, cheese or cinnamon.'),
  ('Extras','Apple Turnover',2.99,'/images/menu/49h.jpg','Pastry filled with sweetened apples, freshly baked today.'),
  ('Extras','Chocolate Cake',3.99,'/images/menu/49i.jpg','Fresh prepared cake slice with sweet and savory taste.'),
  # ── DRINKS (14) ───────────────────────────────────────────────────────────
  ('Drinks','Canned Soda',1.49,'/images/menu/50.jpg','Can of soda: Pepsi, Diet Pepsi, Coke, Orange, Sprite, Ginger Ale, or Iced Tea.'),
  ('Drinks','2-Liter Pepsi',2.99,'/images/menu/51.jpg','Two-liter bottle of Pepsi.'),
  ('Drinks','Bottled Water',1.49,'/images/menu/52.jpg','Poland Spring bottle of water, 16.9 fl oz.'),
  ('Drinks','Snapple',2.99,'/images/menu/53.jpg','Snapple juice bottle: Apple, Lemon Tea, or Peach.'),
  ('Drinks','Gatorade',2.99,'/images/menu/53.jpg','Gatorade thirst quencher: Lemon Lime, Orange, Fruit Punch, or Berry.'),
  ('Drinks','Orange Juice',2.99,'/images/menu/55.jpg','Fresh orange juice.'),
  ('Drinks','Apple Juice',2.99,'/images/menu/56.jpg','Fresh apple juice.'),
  ('Drinks','Cranberry Juice',2.99,'/images/menu/57.jpg','Fresh cranberry juice.'),
  ('Drinks','Pineapple Juice',2.99,'/images/menu/58.jpg','Fresh pineapple juice.'),
  ('Drinks','Mix Juice',3.99,'/images/menu/59.jpg','Mix of any two or more fresh juices.'),
  ('Drinks','Iced Coffee',2.99,'/images/menu/60.jpg','Colombian coffee with your choice of flavor, sugar, and ice.'),
  ('Drinks','Regular Hot Coffee',2.49,'/images/menu/61.jpg','Colombian coffee with your choice of flavor and sugar.'),
  ('Drinks','Hot Chocolate',2.49,'/images/menu/62.jpg','Homemade hot chocolate with your choice of sugar.'),
  ('Drinks','Tea',2.49,'/images/menu/63.jpg','Homemade tea with your choice of kind and sugar.'),
  # ── FAMILY TRAY (9) ───────────────────────────────────────────────────────
  ('Family Tray','Chicken over Rice Family Tray',31.99,'/images/menu/64.jpg','Grilled chicken over rice with vegetable salad and sauces. Serves 4.'),
  ('Family Tray','Lamb over Rice Family Tray',31.99,'/images/menu/65.jpg','Lamb gyro over rice with vegetable salad and sauces. Serves 4.'),
  ('Family Tray','Combo (Lamb & Chicken) Family Tray',34.99,'/images/menu/66.jpg','Chicken and lamb gyro over rice with vegetable salad. Serves 4.'),
  ('Family Tray','Whole Chicken over Rice',24.99,'/images/menu/66b.jpg','Whole grilled specially seasoned chicken (cut in four pieces) over rice with vegetable salad.'),
  ('Family Tray','Jumbo Shrimp Family Tray',36.99,'/images/menu/67.jpg','Jumbo shrimp over rice with vegetable salad. Serves 4.'),
  ('Family Tray','Fish over Rice Family Tray',36.99,'/images/menu/68.jpg','Eight breaded fish cutlets over rice with vegetable salad. Serves 4.'),
  ('Family Tray','Chicken Wings Family Tray',31.99,'/images/menu/69.jpg','24 fried wings over rice with vegetable salad. Buffalo, plain, or BBQ. Serves 4.'),
  ('Family Tray','Eggs & Hot Sausage & Salad Family Tray',29.99,'/images/menu/70.jpg','Six grilled eggs with beef hot sausage and vegetable salad. Serves 4.'),
  ('Family Tray','Dozen Donuts',13.99,'/images/menu/49d2.jpg','A mix of 12 fresh baked donuts.'),
  # ── BUILD YOUR OWN (3) ────────────────────────────────────────────────────
  ('Build Your Own','Build Your Own Bowl',  13.99,'/images/menu/realistic-3d-bowl.png','Choose your base, protein, toppings, and sauce. Fully customized to your taste.'),
  ('Build Your Own','Build Your Own Wrap',  12.99,'/images/menu/27.jpg','Pick your protein, veggies, and sauce wrapped in a fresh flour tortilla or pita.'),
  ('Build Your Own','Build Your Own Platter',17.99,'/images/menu/66.jpg','Choose two proteins, your base, two sides, and two sauces.'),
]

needed_cats = list(dict.fromkeys(i[0] for i in ITEMS))

lines = ["BEGIN;"]
for cat in needed_cats:
    lines.append(f"INSERT INTO categories(name) SELECT '{q(cat)}' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='{q(cat)}');")
lines.append("DELETE FROM menu_items WHERE category_id NOT IN (SELECT id FROM categories WHERE name='Build Your Own');")

for i, (cat, title, price, img, desc) in enumerate(ITEMS):
    pp = round(price * 0.85, 2)
    lines.append(
        f"INSERT INTO menu_items(title,description,price,partner_price,category_id,is_available,image_url,preference)"
        f" SELECT '{q(title)}','{q(desc)}',{price},{pp},id,true,'{img}',{i+1}"
        f" FROM categories WHERE name='{q(cat)}';"
    )

lines.append("COMMIT;")
sql = "\n".join(lines)

r = subprocess.run(
    ['psql', '-h', 'localhost', '-U', USR, '-d', DB],
    input=sql, capture_output=True, text=True, env=env
)
print(r.stdout[-4000:] if r.stdout else "(no stdout)")
if r.stderr:
    print("STDERR:", r.stderr[-500:])
if r.returncode == 0:
    print(f"\n✅ Done — {len(ITEMS)} items inserted across {len(needed_cats)} categories")
else:
    print(f"\n❌ Failed (exit {r.returncode})")
    sys.exit(1)
