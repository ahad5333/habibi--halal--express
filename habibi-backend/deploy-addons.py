#!/usr/bin/env python3
"""
Run on server AFTER deploy-seed.py:
  python3 /tmp/deploy-addons.py

Wipes all choice_groups + addon_groups, then rebuilds them for every item.
"""
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

def q(s): return str(s).replace("'", "''")

# ── Choice group templates ─────────────────────────────────────────────────
# (group_title, grp_pref, [(opt_title, extra_price, is_default, opt_pref)])

BREAD = ('Choose Your Bread', 1, [
    ('Plain Bagel',       0.00, True,  1),
    ('Sesame Bagel',      0.00, False, 2),
    ('Raisin Bagel',      0.00, False, 3),
    ('Whole Wheat Bagel', 0.00, False, 4),
    ('Fresh Roll',        0.00, False, 5),
    ('Pita Bread',        1.00, False, 6),
    ('Croissant',         2.00, False, 7),
    ('Wrap',              1.00, False, 8),
    ('Hero',              2.00, False, 9),
])

NUM_EGGS = ('Number of Eggs', 2, [
    ('2 Eggs', 0.00, True,  1),
    ('3 Eggs', 1.00, False, 2),
    ('4 Eggs', 2.00, False, 3),
])

DONUT_TYPE = ('Donut Type', 1, [
    ('Glazed',              0.00, True,  1),
    ('Boston Kreme',        0.00, False, 2),
    ('Vanilla Creme',       0.00, False, 3),
    ('Jelly',               0.00, False, 4),
    ('Chocolate Butternut', 0.00, False, 5),
    ('Chocolate Frosted',   0.00, False, 6),
    ('Sprinkles',           0.00, False, 7),
    ('Coffee Roll',         0.00, False, 8),
    ('Maple Creme',         0.00, False, 9),
    ('Powdered',            0.00, False, 10),
])

MUFFIN_TYPE = ('Muffin Type', 1, [
    ('Blueberry',      0.00, True,  1),
    ('Banana',         0.00, False, 2),
    ('Chocolate',      0.00, False, 3),
    ('Apple-Cinnamon', 0.00, False, 4),
    ('Almond',         0.00, False, 5),
])

DANISH_TYPE = ('Danish Type', 1, [
    ('Cheese Danish',   0.00, True,  1),
    ('Cinnamon Danish', 0.00, False, 2),
])

SODA_FLAVOR = ('Soda Flavor', 1, [
    ('Pepsi',      0.00, True,  1),
    ('Diet Pepsi', 0.00, False, 2),
    ('Coke',       0.00, False, 3),
    ('Orange',     0.00, False, 4),
    ('Sprite',     0.00, False, 5),
    ('Ginger Ale', 0.00, False, 6),
    ('Iced Tea',   0.00, False, 7),
])

SNAPPLE_FLAVOR = ('Snapple Flavor', 1, [
    ('Apple',     0.00, True,  1),
    ('Lemon Tea', 0.00, False, 2),
    ('Peach',     0.00, False, 3),
])

GATORADE_FLAVOR = ('Gatorade Flavor', 1, [
    ('Lemon Lime',  0.00, True,  1),
    ('Orange',      0.00, False, 2),
    ('Fruit Punch', 0.00, False, 3),
    ('Berry',       0.00, False, 4),
])

JUICE_SIZE = ('Size', 1, [
    ('Regular', 0.00, True,  1),
    ('Large',   1.50, False, 2),
])

COFFEE_SUGAR = ('Sugar', 1, [
    ('Sugar',    0.00, True,  1),
    ('Equal',    0.00, False, 2),
    ('Splenda',  0.00, False, 3),
    ('No Sugar', 0.00, False, 4),
])

COFFEE_MILK = ('Milk', 2, [
    ('Regular Milk',   0.00, True,  1),
    ('Half and Half',  0.00, False, 2),
    ('Skim Milk',      0.00, False, 3),
    ('Hazelnut',       0.00, False, 4),
    ('French Vanilla', 0.00, False, 5),
    ('No Milk',        0.00, False, 6),
])

COFFEE_ICE = ('Ice', 3, [
    ('Regular Ice', 0.00, True,  1),
    ('Less Ice',    0.00, False, 2),
    ('Extra Ice',   0.00, False, 3),
    ('No Ice',      0.00, False, 4),
])

COFFEE_SIZE = ('Size', 4, [
    ('Regular', 0.00, True,  1),
    ('Large',   1.00, False, 2),
])

TEA_SWEETNESS = ('Sweetness', 1, [
    ('No Sugar',     0.00, False, 1),
    ('Medium Sweet', 0.00, True,  2),
    ('Very Sweet',   0.00, False, 3),
])

TEA_SIZE = ('Size', 2, [
    ('Regular', 0.00, True,  1),
    ('Large',   1.00, False, 2),
])

WINGS_FLAVOR = ('Wing Sauce', 1, [
    ('Plain',   0.00, True,  1),
    ('Buffalo', 0.00, False, 2),
    ('BBQ',     0.00, False, 3),
])

BYO_BREAD = ('Choose Your Bread', 1, [
    ('Plain Bagel',       0.00, True,  1),
    ('Sesame Bagel',      0.00, False, 2),
    ('Raisin Bagel',      0.00, False, 3),
    ('Whole Wheat Bagel', 0.00, False, 4),
    ('Fresh Roll',        0.00, False, 5),
    ('Pita Bread',        0.00, False, 6),
    ('Croissant',         0.00, False, 7),
    ('Hero',              0.00, False, 8),
    ('Wrap',              0.00, False, 9),
    ('Burger Bun',        0.00, False, 10),
    ('Hot Dog Bun',       0.00, False, 11),
])

BYO_CHEESE = ('Choose Your Cheese', 2, [
    ('No Cheese',            0.00, True,  1),
    ('American Cheese',      1.00, False, 2),
    ('Extra American Cheese',2.00, False, 3),
    ('Cream Cheese',         3.00, False, 4),
    ('Butter',               3.00, False, 5),
])

BYO_PROTEIN = ('Choose Your Protein', 3, [
    ('One Egg',                    1.00, True,  1),
    ('Two Eggs',                   2.00, False, 2),
    ('Three Eggs',                 3.00, False, 3),
    ('Bacon',                      4.00, False, 4),
    ('Hot Sausage',                3.00, False, 5),
    ('Italian Sausage',            6.00, False, 6),
    ('Hot Dog',                    2.00, False, 7),
    ('Turkey',                     7.00, False, 8),
    ('Lamb Gyro',                  8.00, False, 9),
    ('Grilled Chicken',            8.00, False, 10),
    ('Chicken Shish Kabab',        3.00, False, 11),
    ('Beef Shish Kabab',           4.00, False, 12),
    ('Double Chicken Shish Kabab', 6.00, False, 13),
    ('Double Beef Shish Kabab',    8.00, False, 14),
    ('Kabab Philly Steak',         6.00, False, 15),
    ('Falafel',                    7.00, False, 16),
    ('Fish Fillet',                7.00, False, 17),
    ('Tuna Fish',                  8.00, False, 18),
    ('Beef Burger',                6.00, False, 19),
    ('Chicken Burger',             6.00, False, 20),
])

# ── Addon group templates ──────────────────────────────────────────────────
# (group_title, grp_pref, [(opt_title, price, opt_pref)])

SAUCE = ('Sauce', 1, [
    ('No Sauce',            0.00, 1),
    ('White Sauce',         0.50, 2),
    ('Blue Cheese',         1.00, 3),
    ('Ketchup',             0.50, 4),
    ('BBQ Sauce',           0.50, 5),
    ('Mustard',             0.50, 6),
    ('Special Green Sauce', 0.50, 7),
    ('Mayonnaise',          0.75, 8),
])

ADD_DRINK = ('Add a Drink', 2, [
    ('Bottle of Water',  1.00, 1),
    ('Can of Soda',      1.00, 2),
    ('Snapple',          2.50, 3),
    ('Gatorade',         2.50, 4),
    ('Orange Juice',     2.50, 5),
    ('Apple Juice',      2.50, 6),
    ('Cranberry Juice',  2.50, 7),
    ('Pineapple Juice',  2.50, 8),
])

EXTRA_PROTEIN = ('Extras', 2, [
    ('Extra Egg',      1.00, 1),
    ('Extra Two Eggs', 2.00, 2),
    ('Double Meat',    4.00, 3),
])

WINGS_EXTRAS = ('Add More', 2, [
    ('Extra Three Wings',              2.50, 1),
    ('Extra Rice',                     2.00, 2),
    ('French Fries',                   2.00, 3),
    ('Pita Bread',                     1.00, 4),
    ('Add 4 Falafel with White Sauce', 2.25, 5),
    ('Add 3 Samosa',                   2.50, 6),
])

EXTRA_MEAT = ('Extras', 2, [
    ('Extra Meat', 2.50, 1),
])

MAKE_MEAL = ('Make It a Meal', 2, [
    ('French Fries',                   2.00, 1),
    ('Pita Bread',                     1.00, 2),
    ('Extra Rice',                     2.00, 3),
    ('Add 4 Falafel with White Sauce', 2.25, 4),
    ('Add 3 Samosa',                   2.50, 5),
])

BYO_VEGGIES = ('Add Vegetables', 3, [
    ('Onions',        0.00, 1),
    ('Green Peppers', 0.00, 2),
    ('Cucumbers',     0.00, 3),
    ('Lettuce',       0.00, 4),
    ('Tomatoes',      0.00, 5),
])

# ── Item → groups mapping ─────────────────────────────────────────────────
# (category, item_title, [choice_groups...], [addon_groups...])

ITEM_DEFS = [
    # ── BREAKFAST ────────────────────────────────────────────────────────────
    ('Breakfast', 'Cream Cheese Sandwich',                      [BREAD],           []),
    ('Breakfast', 'Eggs Sandwich',                              [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Breakfast', 'Eggs & Cheese Sandwich',                     [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Breakfast', 'Eggs & Halal Bacon Sandwich',                [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Breakfast', 'Eggs & Beef Burger Sandwich',                [BREAD, NUM_EGGS], []),
    ('Breakfast', 'Eggs & Hot Dog Sandwich',                    [BREAD, NUM_EGGS], []),
    ('Breakfast', 'Eggs & Sausage Sandwich',                    [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Breakfast', 'Eggs & Cheese & Sausage Sandwich',           [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Breakfast', 'Eggs & Italian Sausage Sandwich',            [BREAD, NUM_EGGS], []),
    ('Breakfast', 'Tuna Fish Salad Sandwich',                   [BREAD],           [EXTRA_MEAT]),
    ('Breakfast', 'Tuna Fish Egg Salad Melt Deluxe Sandwich',   [BREAD, NUM_EGGS], [EXTRA_MEAT]),
    ('Breakfast', 'Tuna Fish Salad over Turkey Sandwich',       [BREAD],           [EXTRA_MEAT]),
    ('Breakfast', 'Turkey Sandwich',                            [BREAD],           [EXTRA_MEAT]),
    ('Breakfast', 'Turkey with Halal Bacon Sandwich',           [BREAD],           [EXTRA_MEAT]),
    ('Breakfast', 'Chopped Cheese Sandwich',                    [],                [SAUCE]),
    ('Breakfast', 'Halal Bacon Sandwich',                       [BREAD],           []),
    ('Breakfast', 'Halal Bacon and Sausage Sandwich',           [BREAD],           []),
    ('Breakfast', 'Falafel Sandwich',                           [],                [SAUCE]),
    ('Breakfast', 'Falafel Salad Plate',                        [],                [SAUCE]),
    ('Breakfast', 'Eggs & Cheese & Salad Plate',                [],                [SAUCE]),
    ('Breakfast', 'Eggs & Beef Burger & Salad Plate',           [],                [SAUCE]),
    ('Breakfast', 'Eggs & Hot Dog & Salad Plate',               [],                [SAUCE]),
    ('Breakfast', 'Halal Bacon and Sausage Salad Plate',        [],                [SAUCE]),
    ('Breakfast', 'Eggs & Hot Sausage & Salad Plate',           [],                [SAUCE]),
    ('Breakfast', 'Eggs & Italian Sausage & Salad Plate',       [],                [SAUCE]),
    ('Breakfast', 'Mix Green Salad Plate',                      [],                [SAUCE]),
    ('Breakfast', 'Donut',                                      [DONUT_TYPE],      []),
    ('Breakfast', 'Dozen Donuts',                               [DONUT_TYPE],      []),
    ('Breakfast', 'Muffin',                                     [MUFFIN_TYPE],     []),
    ('Breakfast', 'Danish',                                     [DANISH_TYPE],     []),

    # ── PLATTER ──────────────────────────────────────────────────────────────
    ('Platter', 'Chicken over Rice',                    [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Chicken Salad',                        [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Chicken Fries',                        [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Lamb over Rice',                       [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Lamb Salad',                           [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Lamb Fries',                           [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Combo (Lamb & Chicken) over Rice',     [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Combo (Lamb & Chicken) Salad',         [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Combo (Lamb & Chicken) Fries',         [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Half Chicken over Rice',               [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Half Grilled Chicken Salad',           [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Mix Green Salad',                      [], [SAUCE]),
    ('Platter', 'Jumbo Shrimp over Rice',               [], [SAUCE, ADD_DRINK, MAKE_MEAL]),
    ('Platter', 'Jumbo Shrimp Fries',                   [], [SAUCE, ADD_DRINK, MAKE_MEAL]),
    ('Platter', 'Jumbo Shrimp Salad',                   [], [SAUCE, ADD_DRINK, MAKE_MEAL]),
    ('Platter', 'Fish over Rice',                       [], [SAUCE, ADD_DRINK, MAKE_MEAL]),
    ('Platter', 'Fish over Salad',                      [], [SAUCE, ADD_DRINK, MAKE_MEAL]),
    ('Platter', 'Fish with Fries',                      [], [SAUCE, ADD_DRINK, MAKE_MEAL]),
    ('Platter', 'Plain Chicken Wings over Rice',        [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'Buffalo Chicken Wings over Rice',      [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'BBQ Chicken Wings over Rice',          [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'Plain Chicken Wings with Salad',       [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'Buffalo Chicken Wings with Salad',     [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'BBQ Chicken Wings with Salad',         [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'Plain Chicken Wings with Fries',       [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'Buffalo Chicken Wings with Fries',     [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'BBQ Chicken Wings with Fries',         [], [SAUCE, ADD_DRINK, WINGS_EXTRAS]),
    ('Platter', 'Falafel over Rice',                    [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Falafel Salad',                        [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Empanadas over Rice and Salad',        [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Tuna Fish Salad Plate',                [], [SAUCE, ADD_DRINK, EXTRA_MEAT]),
    ('Platter', 'Tuna Fish Egg Salad Melt Deluxe Plate',[], [SAUCE, ADD_DRINK, EXTRA_MEAT]),
    ('Platter', 'Turkey over Rice',                     [], [SAUCE, ADD_DRINK, EXTRA_MEAT]),
    ('Platter', 'Turkey with Halal Bacon Plate',        [], [SAUCE, ADD_DRINK, EXTRA_MEAT]),
    ('Platter', 'Italian Sausage over Rice',            [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Italian Sausage Salad',                [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Double Chicken Shish Kebab over Rice', [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Double Chicken Shish Salad',           [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Double Beef Shish Kebab over Rice',    [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Double Beef Shish Salad',              [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Eggs & Cheese & Salad',                [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Eggs & Beef Burger & Salad',           [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Eggs & Hot Dog & Salad',               [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Halal Bacon and Sausage Salad',        [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Eggs & Hot Sausage & Salad',           [], [SAUCE, ADD_DRINK]),
    ('Platter', 'Eggs & Italian Sausage & Salad',       [], [SAUCE, ADD_DRINK]),

    # ── SANDWICH ─────────────────────────────────────────────────────────────
    ('Sandwich', 'Chicken Gyro',                               [],                [SAUCE]),
    ('Sandwich', 'Lamb Gyro',                                  [],                [SAUCE]),
    ('Sandwich', 'Combo (Lamb & Chicken) Sandwich',            [],                [SAUCE]),
    ('Sandwich', 'Jumbo Shrimp Sandwich',                      [BREAD],           [SAUCE, MAKE_MEAL]),
    ('Sandwich', 'Fish Fillet Sandwich',                       [BREAD],           [SAUCE, MAKE_MEAL]),
    ('Sandwich', 'Falafel Sandwich',                           [],                [SAUCE]),
    ('Sandwich', 'Philly Cheese Steak',                        [],                [SAUCE]),
    ('Sandwich', 'Hot Dog',                                    [],                [SAUCE]),
    ('Sandwich', 'Hot Sausage',                                [],                [SAUCE]),
    ('Sandwich', 'Italian Sausage Sandwich',                   [],                [SAUCE]),
    ('Sandwich', 'Chicken Shish Kebab Sandwich',               [],                [SAUCE]),
    ('Sandwich', 'Double Chicken Shish Kebab Sandwich',        [],                [SAUCE]),
    ('Sandwich', 'Beef Shish Kebab Sandwich',                  [],                [SAUCE]),
    ('Sandwich', 'Double Beef Shish Kebab Sandwich',           [],                [SAUCE]),
    ('Sandwich', 'Beef Burger',                                [],                [SAUCE]),
    ('Sandwich', 'Chicken Burger',                             [],                [SAUCE]),
    ('Sandwich', 'Cheese Beef Burger',                         [],                [SAUCE]),
    ('Sandwich', 'Cheese Chicken Burger',                      [],                [SAUCE]),
    ('Sandwich', 'Chopped Cheese Sandwich',                    [],                [SAUCE]),
    ('Sandwich', 'Halal Bacon Sandwich',                       [BREAD],           [SAUCE]),
    ('Sandwich', 'Halal Bacon and Sausage Sandwich',           [BREAD],           [SAUCE]),
    ('Sandwich', 'Tuna Fish Salad Sandwich',                   [BREAD],           [SAUCE, EXTRA_MEAT]),
    ('Sandwich', 'Tuna Fish Egg Salad Melt Deluxe Sandwich',   [BREAD, NUM_EGGS], [SAUCE, EXTRA_MEAT]),
    ('Sandwich', 'Tuna Fish Salad over Turkey Sandwich',       [BREAD],           [SAUCE, EXTRA_MEAT]),
    ('Sandwich', 'Turkey Sandwich',                            [BREAD],           [SAUCE, EXTRA_MEAT]),
    ('Sandwich', 'Turkey with Halal Bacon Sandwich',           [BREAD],           [SAUCE, EXTRA_MEAT]),
    ('Sandwich', 'Bagel / Roll with Cream Cheese',             [BREAD],           []),
    ('Sandwich', 'Eggs Sandwich',                              [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Sandwich', 'Cream Cheese Sandwich',                      [BREAD],           []),
    ('Sandwich', 'Eggs & Cheese Sandwich',                     [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Sandwich', 'Eggs & Halal Bacon Sandwich',                [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Sandwich', 'Eggs & Beef Burger Sandwich',                [BREAD, NUM_EGGS], []),
    ('Sandwich', 'Eggs & Hot Dog Sandwich',                    [BREAD, NUM_EGGS], []),
    ('Sandwich', 'Eggs & Sausage Sandwich',                    [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Sandwich', 'Eggs & Cheese & Sausage Sandwich',           [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Sandwich', 'Eggs & Italian Sausage Sandwich',            [BREAD, NUM_EGGS], []),
    ('Sandwich', 'Eggs Sandwich (Bagel / Roll / Croissant / Pita)', [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),

    # ── BURGERS ──────────────────────────────────────────────────────────────
    ('Burgers', 'Beef Burger',                    [],                [SAUCE]),
    ('Burgers', 'Beef Burger Deluxe',             [],                [SAUCE]),
    ('Burgers', 'Double Beef Burger',             [],                [SAUCE]),
    ('Burgers', 'Double Beef Burger Deluxe',      [],                [SAUCE]),
    ('Burgers', 'Chicken Burger',                 [],                [SAUCE]),
    ('Burgers', 'Chicken Burger Deluxe',          [],                [SAUCE]),
    ('Burgers', 'Double Chicken Burger',          [],                [SAUCE]),
    ('Burgers', 'Cheese Beef Burger',             [],                [SAUCE]),
    ('Burgers', 'Cheese Chicken Burger',          [],                [SAUCE]),
    ('Burgers', 'Eggs & Beef Burger Sandwich',    [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Burgers', 'Eggs & Chicken Burger Sandwich', [BREAD, NUM_EGGS], [EXTRA_PROTEIN]),
    ('Burgers', 'Eggs & Beef Burger & Salad Plate', [],              [SAUCE]),
    ('Burgers', 'Eggs & Beef Burger & Salad',     [],                [SAUCE]),

    # ── TACOS ────────────────────────────────────────────────────────────────
    ('Tacos', 'Chicken Taco',    [], [SAUCE]),
    ('Tacos', 'Beef Taco',       [], [SAUCE]),
    ('Tacos', 'Lamb Taco',       [], [SAUCE]),
    ('Tacos', 'Beef Steak Taco', [], [SAUCE]),
    ('Tacos', 'Shrimp Taco',     [], [SAUCE]),
    ('Tacos', 'Hot Dog Taco',    [], [SAUCE]),
    ('Tacos', 'Sausage Taco',    [], [SAUCE]),
    ('Tacos', 'Falafel Taco',    [], [SAUCE]),

    # ── EXTRAS ───────────────────────────────────────────────────────────────
    ('Extras', 'Habibi Jerk Plate',          [],           [SAUCE]),
    ('Extras', 'Chicken Shish Kebab Stick',  [],           [SAUCE]),
    ('Extras', 'Beef Shish Kebab Stick',     [],           [SAUCE]),
    ('Extras', 'French Fries',               [],           [SAUCE]),
    ('Extras', 'French Fries Plate (Large)', [],           [SAUCE]),
    ('Extras', 'Rice Plate',                 [],           [SAUCE]),
    ('Extras', 'Double Rice Plate',          [],           [SAUCE]),
    ('Extras', 'Side Salad Mix Plate',       [],           [SAUCE]),
    ('Extras', 'Empanada',                   [],           [SAUCE]),
    ('Extras', 'Mozzarella Sticks',          [],           [SAUCE]),
    ('Extras', 'Onion Rings',                [],           [SAUCE]),
    ('Extras', 'Donut',                      [DONUT_TYPE], []),
    ('Extras', 'Dozen Donuts',               [DONUT_TYPE], []),
    ('Extras', 'Muffin',                     [MUFFIN_TYPE],[]),
    ('Extras', 'Danish',                     [DANISH_TYPE],[]),

    # ── DRINKS ───────────────────────────────────────────────────────────────
    ('Drinks', 'Canned Soda',       [SODA_FLAVOR],                             []),
    ('Drinks', 'Snapple',           [SNAPPLE_FLAVOR],                          []),
    ('Drinks', 'Gatorade',          [GATORADE_FLAVOR],                         []),
    ('Drinks', 'Orange Juice',      [JUICE_SIZE],                              []),
    ('Drinks', 'Apple Juice',       [JUICE_SIZE],                              []),
    ('Drinks', 'Cranberry Juice',   [JUICE_SIZE],                              []),
    ('Drinks', 'Pineapple Juice',   [JUICE_SIZE],                              []),
    ('Drinks', 'Mix Juice',         [JUICE_SIZE],                              []),
    ('Drinks', 'Iced Coffee',       [COFFEE_SUGAR, COFFEE_MILK, COFFEE_ICE, COFFEE_SIZE], []),
    ('Drinks', 'Regular Hot Coffee',[COFFEE_SUGAR, COFFEE_MILK, COFFEE_SIZE], []),
    ('Drinks', 'Hot Chocolate',     [COFFEE_SUGAR],                            []),
    ('Drinks', 'Tea',               [TEA_SWEETNESS, TEA_SIZE],                 []),

    # ── FAMILY TRAY ──────────────────────────────────────────────────────────
    ('Family Tray', 'Chicken over Rice Family Tray',          [],             [SAUCE]),
    ('Family Tray', 'Lamb over Rice Family Tray',             [],             [SAUCE]),
    ('Family Tray', 'Combo (Lamb & Chicken) Family Tray',     [],             [SAUCE]),
    ('Family Tray', 'Whole Chicken over Rice',                [],             [SAUCE]),
    ('Family Tray', 'Jumbo Shrimp Family Tray',               [],             [SAUCE]),
    ('Family Tray', 'Fish over Rice Family Tray',             [],             [SAUCE]),
    ('Family Tray', 'Chicken Wings Family Tray',              [WINGS_FLAVOR], [SAUCE]),
    ('Family Tray', 'Eggs & Hot Sausage & Salad Family Tray', [],             [SAUCE]),
    ('Family Tray', 'Dozen Donuts',                           [DONUT_TYPE],   []),

    # ── BUILD YOUR OWN ────────────────────────────────────────────────────────
    ('Build Your Own', 'Build Your Own Bowl',    [], [SAUCE, ADD_DRINK]),
    ('Build Your Own', 'Build Your Own Wrap',    [], [SAUCE, ADD_DRINK]),
    ('Build Your Own', 'Build Your Own Platter', [], [SAUCE, ADD_DRINK]),
    ('Build Your Own', 'Build Your Own Sandwich',
        [BYO_BREAD, BYO_CHEESE, BYO_PROTEIN], [BYO_VEGGIES, SAUCE]),
]

# ── SQL generators ────────────────────────────────────────────────────────

def choice_sql(cat, title, grp_title, grp_pref, options):
    vals = ', '.join(
        f"('{q(ot)}'::text, {ep:.2f}::numeric, {str(isd).lower()}::boolean, {op}::int)"
        for ot, ep, isd, op in options
    )
    return (
        f"WITH ng AS (\n"
        f"  INSERT INTO choice_groups(menu_item_id, title, preference)\n"
        f"  SELECT m.id, '{q(grp_title)}', {grp_pref}\n"
        f"  FROM menu_items m JOIN categories c ON m.category_id=c.id\n"
        f"  WHERE m.title='{q(title)}' AND c.name='{q(cat)}'\n"
        f"  RETURNING id\n"
        f")\n"
        f"INSERT INTO choice_options(choice_group_id, title, extra_price, is_default, preference)\n"
        f"SELECT ng.id, v.t, v.ep, v.d, v.p\n"
        f"FROM ng, (VALUES {vals}) AS v(t,ep,d,p);\n"
    )

def addon_sql(cat, title, grp_title, grp_pref, options):
    vals = ', '.join(
        f"('{q(ot)}'::text, {price:.2f}::numeric, {op}::int)"
        for ot, price, op in options
    )
    return (
        f"WITH ng AS (\n"
        f"  INSERT INTO addon_groups(menu_item_id, title, preference)\n"
        f"  SELECT m.id, '{q(grp_title)}', {grp_pref}\n"
        f"  FROM menu_items m JOIN categories c ON m.category_id=c.id\n"
        f"  WHERE m.title='{q(title)}' AND c.name='{q(cat)}'\n"
        f"  RETURNING id\n"
        f")\n"
        f"INSERT INTO addon_options(addon_group_id, title, price, preference)\n"
        f"SELECT ng.id, v.t, v.p, v.op\n"
        f"FROM ng, (VALUES {vals}) AS v(t,p,op);\n"
    )

# ── Build SQL ─────────────────────────────────────────────────────────────

lines = ["BEGIN;"]

# Clean slate — cascade handles child rows automatically
lines.append("DELETE FROM choice_groups;")
lines.append("DELETE FROM addon_groups;")

# Ensure all Build Your Own items exist (older seeds may have wiped them)
BYO_ITEMS = [
    ('Build Your Own Bowl',    13.99, '/images/menu/realistic-3d-bowl.png',
     'Choose your base, protein, toppings, and sauce. Fully customized to your taste.', 198),
    ('Build Your Own Wrap',    12.99, '/images/menu/27.jpg',
     'Pick your protein, veggies, and sauce wrapped in a fresh flour tortilla or pita.', 199),
    ('Build Your Own Platter', 17.99, '/images/menu/66.jpg',
     'Choose two proteins, your base, two sides, and two sauces.', 200),
    ('Build Your Own Sandwich', 0.00, '/images/menu/35f.jpg',
     'Build your own sandwich — choose your bread, protein, cheese, and vegetables.', 201),
]
for byo_title, byo_price, byo_img, byo_desc, byo_pref in BYO_ITEMS:
    byo_pp = round(byo_price * 0.85, 2)
    lines.append(
        f"INSERT INTO menu_items(title,description,price,partner_price,category_id,is_available,image_url,preference)\n"
        f"SELECT '{q(byo_title)}','{q(byo_desc)}',{byo_price},{byo_pp},c.id,true,'{byo_img}',{byo_pref}\n"
        f"FROM categories c WHERE c.name='Build Your Own'\n"
        f"AND NOT EXISTS (\n"
        f"  SELECT 1 FROM menu_items mi JOIN categories cx ON mi.category_id=cx.id\n"
        f"  WHERE mi.title='{q(byo_title)}' AND cx.name='Build Your Own'\n"
        f");"
    )

choice_count = 0
addon_count  = 0

for cat, title, choices, addons in ITEM_DEFS:
    for grp in choices:
        grp_title, grp_pref, options = grp
        lines.append(choice_sql(cat, title, grp_title, grp_pref, options))
        choice_count += 1
    for grp in addons:
        grp_title, grp_pref, options = grp
        lines.append(addon_sql(cat, title, grp_title, grp_pref, options))
        addon_count += 1

lines.append("COMMIT;")
sql = "\n".join(lines)

r = subprocess.run(
    ['psql', '-h', 'localhost', '-U', USR, '-d', DB],
    input=sql, capture_output=True, text=True, env=env
)

print(r.stdout[-8000:] if r.stdout else "(no stdout)")
if r.stderr:
    print("STDERR:", r.stderr[-1000:])
if r.returncode == 0:
    print(f"\n✅ Done — {choice_count} choice groups, {addon_count} addon groups inserted")
    print(f"   Items covered: {len(ITEM_DEFS)}")
else:
    print(f"\n❌ Failed (exit {r.returncode})")
    sys.exit(1)
