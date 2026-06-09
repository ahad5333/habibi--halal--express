/**
 * seed-menu-addons.js
 * Populates menus.choices (required groups) and menus.addons (optional groups)
 * for every item in the menus table, based on the Updated Menu Sheet.
 *
 * Run:  node seed-menu-addons.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

// ─── Choice Group Templates (required, single-select) ─────────────────────

const BREAD_STANDARD = {
  title: 'Choose Your Bread',
  options: [
    { title: 'Plain Bagel',       extra_price: 0.00, is_default: true  },
    { title: 'Sesame Bagel',      extra_price: 0.00 },
    { title: 'Raisin Bagel',      extra_price: 0.00 },
    { title: 'Whole Wheat Bagel', extra_price: 0.00 },
    { title: 'Fresh Roll',        extra_price: 0.00 },
    { title: 'Pita Bread',        extra_price: 1.00 },
    { title: 'Croissant',         extra_price: 2.00 },
    { title: 'Wrap',              extra_price: 1.00 },
    { title: 'Hero',              extra_price: 2.00 },
  ],
};

const BREAD_BURGER = {
  title: 'Choose Your Bread',
  options: [
    { title: 'Burger Bun',        extra_price: 0.00, is_default: true  },
    { title: 'Plain Bagel',       extra_price: 0.00 },
    { title: 'Sesame Bagel',      extra_price: 0.00 },
    { title: 'Raisin Bagel',      extra_price: 0.00 },
    { title: 'Whole Wheat Bagel', extra_price: 0.00 },
    { title: 'Fresh Roll',        extra_price: 0.00 },
    { title: 'Pita Bread',        extra_price: 1.00 },
    { title: 'Croissant',         extra_price: 2.00 },
  ],
};

const BREAD_HOTDOG = {
  title: 'Choose Your Bread',
  options: [
    { title: 'Hot Dog Bun',       extra_price: 0.00, is_default: true  },
    { title: 'Plain Bagel',       extra_price: 0.00 },
    { title: 'Sesame Bagel',      extra_price: 0.00 },
    { title: 'Raisin Bagel',      extra_price: 0.00 },
    { title: 'Whole Wheat Bagel', extra_price: 0.00 },
    { title: 'Fresh Roll',        extra_price: 0.00 },
    { title: 'Pita Bread',        extra_price: 0.00 },
    { title: 'Croissant',         extra_price: 2.00 },
    { title: 'Wrap',              extra_price: 1.00 },
    { title: 'Hero',              extra_price: 3.00 },
  ],
};

const BREAD_SMALL = {
  title: 'Choose Your Bread',
  options: [
    { title: 'Fresh Roll',  extra_price: 0.00, is_default: true },
    { title: 'Pita Bread',  extra_price: 0.00 },
    { title: 'Hero',        extra_price: 1.00 },
  ],
};

const BREAD_CHOPPED_CHEESE = {
  title: 'Choose Your Bread',
  options: [
    { title: 'Hero',       extra_price: 0.00, is_default: true },
    { title: 'Pita Bread', extra_price: 0.00 },
  ],
};

const BREAD_PITA_HERO = {
  title: 'Choose Your Bread',
  options: [
    { title: 'Pita Bread', extra_price: 0.00, is_default: true },
    { title: 'Wrap',       extra_price: 0.00 },
    { title: 'Hero',       extra_price: 2.00 },
  ],
};

const NUM_EGGS = {
  title: 'Number of Eggs',
  options: [
    { title: '2 Eggs', extra_price: 0.00, is_default: true },
    { title: '3 Eggs', extra_price: 1.00 },
    { title: '4 Eggs', extra_price: 2.00 },
  ],
};

const DONUT_TYPE = {
  title: 'Donut Type',
  options: [
    { title: 'Glazed',              extra_price: 0.00, is_default: true },
    { title: 'Boston Kreme',        extra_price: 0.00 },
    { title: 'Vanilla Creme',       extra_price: 0.00 },
    { title: 'Jelly',               extra_price: 0.00 },
    { title: 'Chocolate Butternut', extra_price: 0.00 },
    { title: 'Chocolate Frosted',   extra_price: 0.00 },
    { title: 'Sprinkles',           extra_price: 0.00 },
    { title: 'Coffee Roll',         extra_price: 0.00 },
    { title: 'Maple Creme',         extra_price: 0.00 },
    { title: 'Powdered',            extra_price: 0.00 },
  ],
};

const MUFFIN_TYPE = {
  title: 'Muffin Type',
  options: [
    { title: 'Blueberry',      extra_price: 0.00, is_default: true },
    { title: 'Banana',         extra_price: 0.00 },
    { title: 'Chocolate',      extra_price: 0.00 },
    { title: 'Apple-Cinnamon', extra_price: 0.00 },
    { title: 'Almond',         extra_price: 0.00 },
  ],
};

const DANISH_TYPE = {
  title: 'Danish Type',
  options: [
    { title: 'Cheese Danish',   extra_price: 0.00, is_default: true },
    { title: 'Cinnamon Danish', extra_price: 0.00 },
  ],
};

const SODA_FLAVOR = {
  title: 'Soda Flavor',
  options: [
    { title: 'Pepsi',      extra_price: 0.00, is_default: true },
    { title: 'Diet Pepsi', extra_price: 0.00 },
    { title: 'Coke',       extra_price: 0.00 },
    { title: 'Orange',     extra_price: 0.00 },
    { title: 'Sprite',     extra_price: 0.00 },
    { title: 'Ginger Ale', extra_price: 0.00 },
    { title: 'Iced Tea',   extra_price: 0.00 },
  ],
};

const SNAPPLE_FLAVOR = {
  title: 'Snapple Flavor',
  options: [
    { title: 'Apple',     extra_price: 0.00, is_default: true },
    { title: 'Lemon Tea', extra_price: 0.00 },
    { title: 'Peach',     extra_price: 0.00 },
  ],
};

const GATORADE_FLAVOR = {
  title: 'Gatorade Flavor',
  options: [
    { title: 'Lemon Lime',  extra_price: 0.00, is_default: true },
    { title: 'Orange',      extra_price: 0.00 },
    { title: 'Fruit Punch', extra_price: 0.00 },
    { title: 'Berry',       extra_price: 0.00 },
  ],
};

const JUICE_SIZE = {
  title: 'Size',
  options: [
    { title: 'Regular', extra_price: 0.00, is_default: true },
    { title: 'Large',   extra_price: 1.50 },
  ],
};

const COFFEE_SUGAR = {
  title: 'Sugar',
  options: [
    { title: 'No Sugar', extra_price: 0.00, is_default: true },
    { title: 'Sugar',    extra_price: 0.00 },
    { title: 'Equal',    extra_price: 0.00 },
    { title: 'Splenda',  extra_price: 0.00 },
  ],
};

const COFFEE_MILK = {
  title: 'Milk / Flavor',
  options: [
    { title: 'Regular Milk',   extra_price: 0.00, is_default: true },
    { title: 'Half and Half',  extra_price: 0.00 },
    { title: 'Skim Milk',      extra_price: 0.00 },
    { title: 'Hazelnut',       extra_price: 0.50 },
    { title: 'French Vanilla', extra_price: 0.50 },
    { title: 'No Milk',        extra_price: 0.00 },
  ],
};

const COFFEE_ICE = {
  title: 'Ice',
  options: [
    { title: 'Regular Ice', extra_price: 0.00, is_default: true },
    { title: 'Less Ice',    extra_price: 0.00 },
    { title: 'Extra Ice',   extra_price: 0.00 },
    { title: 'No Ice',      extra_price: 0.00 },
  ],
};

const COFFEE_SIZE = {
  title: 'Size',
  options: [
    { title: 'Regular', extra_price: 0.00, is_default: true },
    { title: 'Large',   extra_price: 1.00 },
  ],
};

const TEA_SWEETNESS = {
  title: 'Sweetness',
  options: [
    { title: 'No Sugar',     extra_price: 0.00 },
    { title: 'Medium Sweet', extra_price: 0.00, is_default: true },
    { title: 'Very Sweet',   extra_price: 0.00 },
  ],
};

const TEA_SIZE = {
  title: 'Size',
  options: [
    { title: 'Regular', extra_price: 0.00, is_default: true },
    { title: 'Large',   extra_price: 1.00 },
  ],
};

const WINGS_FLAVOR = {
  title: 'Wing Sauce',
  options: [
    { title: 'Plain',   extra_price: 0.00, is_default: true },
    { title: 'Buffalo', extra_price: 0.00 },
    { title: 'BBQ',     extra_price: 0.00 },
  ],
};

// ─── Addon Group Templates (optional, multi-select) ───────────────────────

const SAUCE = {
  title: 'Sauce',
  max_selections: 1,
  options: [
    { title: 'No Sauce',            price: 0.00 },
    { title: 'White Sauce',         price: 0.50 },
    { title: 'Blue Cheese',         price: 1.00 },
    { title: 'Ketchup',             price: 0.50 },
    { title: 'BBQ Sauce',           price: 0.50 },
    { title: 'Mustard',             price: 0.50 },
    { title: 'Special Green Sauce', price: 0.50 },
    { title: 'Mayonnaise',          price: 0.75 },
  ],
};

const ADD_DRINK = {
  title: 'Add a Drink',
  max_selections: 1,
  options: [
    { title: 'Bottle of Water', price: 1.00 },
    { title: 'Can of Soda',     price: 1.00 },
    { title: 'Snapple',         price: 2.50 },
    { title: 'Gatorade',        price: 2.50 },
    { title: 'Orange Juice',    price: 2.50 },
    { title: 'Apple Juice',     price: 2.50 },
    { title: 'Cranberry Juice', price: 2.50 },
    { title: 'Pineapple Juice', price: 2.50 },
  ],
};

const MAKE_MEAL = {
  title: 'Make It a Meal!',
  max_selections: 3,
  options: [
    { title: 'French Fries',                   price: 2.00 },
    { title: 'Pita Bread',                     price: 1.00 },
    { title: 'Extra Rice',                     price: 2.00 },
    { title: 'Add 4 Falafel with White Sauce', price: 2.25 },
    { title: 'Add 3 Samosa',                   price: 2.50 },
  ],
};

const WINGS_EXTRAS = {
  title: 'Add More Wings',
  max_selections: 1,
  options: [
    { title: 'Extra Three Wings (Same Sauce)', price: 2.50 },
    { title: 'Extra Three Wings Plain',        price: 2.50 },
    { title: 'Extra Three Buffalo Wings',      price: 2.50 },
    { title: 'Extra Three BBQ Wings',          price: 2.50 },
  ],
};

const EXTRA_MEAT = {
  title: 'Extra',
  max_selections: 1,
  options: [
    { title: 'Extra Meat', price: 2.50 },
  ],
};

const DOUBLE_MEAT_3 = {
  title: 'Extra',
  max_selections: 1,
  options: [
    { title: 'Double Meat', price: 3.00 },
  ],
};

const DOUBLE_MEAT_4 = {
  title: 'Extra',
  max_selections: 1,
  options: [
    { title: 'Double Meat', price: 4.00 },
  ],
};

const EXTRA_EGG_MEAT_3 = {
  title: 'Extra',
  max_selections: 2,
  options: [
    { title: 'Extra Egg',      price: 1.00 },
    { title: 'Extra Two Eggs', price: 2.00 },
    { title: 'Extra Meat',     price: 3.00 },
  ],
};

const EXTRA_EGG_MEAT_4 = {
  title: 'Extra',
  max_selections: 2,
  options: [
    { title: 'Extra Egg',      price: 1.00 },
    { title: 'Extra Two Eggs', price: 2.00 },
    { title: 'Extra Meat',     price: 4.00 },
  ],
};

const EXTRA_EGG_MEAT_5 = {
  title: 'Extra',
  max_selections: 2,
  options: [
    { title: 'Extra Egg',      price: 1.00 },
    { title: 'Extra Two Eggs', price: 2.00 },
    { title: 'Extra Meat',     price: 5.00 },
  ],
};

const EXTRA_EGG_MEAT_6 = {
  title: 'Extra',
  max_selections: 2,
  options: [
    { title: 'Extra Egg',      price: 1.00 },
    { title: 'Extra Two Eggs', price: 2.00 },
    { title: 'Extra Meat',     price: 6.00 },
  ],
};

const EXTRA_EGG_ONLY = {
  title: 'Extra',
  max_selections: 2,
  options: [
    { title: 'Extra Egg',      price: 1.00 },
    { title: 'Extra Two Eggs', price: 2.00 },
  ],
};

// ─── ID Stamper ──────────────────────────────────────────────────────────────
// Adds numeric IDs to group and option objects (unique per item, not globally).
let _gid = 0;
let _oid = 0;

function stampGroup(group) {
  _gid++;
  return {
    id: _gid,
    ...group,
    options: group.options.map(opt => {
      _oid++;
      return { id: _oid, ...opt };
    }),
  };
}

function buildGroups(groupTemplates) {
  _gid = 0; _oid = 0;
  return groupTemplates.map(stampGroup);
}

// ─── Core resolver ───────────────────────────────────────────────────────────
// Returns { choices: [...], addons: [...] } for a given menus row.
function resolveModifiers(name, category) {
  const n = name.toLowerCase();
  const choices = [];
  const addons  = [];

  // ── Breakfast at YOUR OWN TIME ───────────────────────────────────────────
  if (category === 'Breakfast at YOUR OWN TIME') {

    // Sandwiches that use Burger Bun
    if (n.includes('berger') && n.includes('egg') && n.includes('sandwich')) {
      choices.push(BREAD_BURGER, NUM_EGGS);
      addons.push(DOUBLE_MEAT_3);
    }
    // Sandwiches that use Hot Dog / Sausage bun
    else if ((n.includes('hot dog') || n.includes('sausage')) && n.includes('egg') && n.includes('sandwich')) {
      choices.push(BREAD_HOTDOG, NUM_EGGS);
      addons.push(n.includes('cheese & sausage') ? DOUBLE_MEAT_4 : DOUBLE_MEAT_3);
    }
    // Italian Sausage Sandwich → Pita/Wrap/Hero only
    else if (n.includes('italian sausage') && n.includes('sandwich')) {
      choices.push(BREAD_PITA_HERO, NUM_EGGS);
    }
    // Tuna fish egg salad melt — tuna takes priority, use BREAD_SMALL
    else if (n.includes('tuna') && n.includes('egg') && n.includes('sandwich')) {
      choices.push(BREAD_SMALL, NUM_EGGS);
      addons.push(EXTRA_MEAT);
    }
    // Egg sandwiches (standard bread)
    else if (n.includes('egg') && n.includes('sandwich')) {
      choices.push(BREAD_STANDARD, NUM_EGGS);
      if (n.includes('bacon')) addons.push(DOUBLE_MEAT_3);
    }
    // Tuna / Turkey sandwiches (Roll / Pita / Hero)
    else if ((n.includes('tuna') || n.includes('turkey')) && n.includes('sandwich')) {
      choices.push(BREAD_SMALL);
      addons.push(EXTRA_MEAT);
    }
    // Chopped Cheese → Hero / Pita only
    else if (n.includes('chopped cheese')) {
      choices.push(BREAD_CHOPPED_CHEESE);
      addons.push(SAUCE);
    }
    // Halal Bacon / Bacon-Sausage sandwiches
    else if (n.includes('bacon') && n.includes('sandwich')) {
      choices.push(BREAD_STANDARD);
      if (n.includes('sausage')) addons.push(EXTRA_MEAT);
    }
    // Falafel sandwich
    else if (n.includes('falafel') && n.includes('sandwich')) {
      choices.push(BREAD_PITA_HERO);
      addons.push(SAUCE);
    }
    // Cream cheese / Bagel with something
    else if (n.includes('cream') || n.includes('chesse') || n.includes('better') || n.includes('butter')) {
      choices.push(BREAD_STANDARD);
    }

    // Salad plates (no sandwich in name)
    if (n.includes('salad plate') || (n.includes('salad') && !n.includes('sandwich'))) {
      addons.push(SAUCE);
      if (n.includes('berger') || n.includes('hot dog') || n.includes('sausage') || n.includes('bacon')) {
        if      (n.includes('bacon and sausage')) addons.push(EXTRA_EGG_MEAT_5);
        else if (n.includes('hot sausage'))       addons.push(EXTRA_EGG_MEAT_6);
        else if (n.includes('hot dog'))           addons.push(EXTRA_EGG_MEAT_4);
        else if (n.includes('berger'))            addons.push(EXTRA_EGG_MEAT_3);
        else if (n.includes('italian sausage'))   addons.push(EXTRA_EGG_ONLY);
      }
    }

    // Pastries / Baked goods
    if (n === 'donut' || n.startsWith('donut'))          choices.push(DONUT_TYPE);
    if (n === 'dozen donuts' || n.includes('dozen'))     choices.push(DONUT_TYPE);
    if (n.startsWith('muffin') || n === 'muffin')        choices.push(MUFFIN_TYPE);
    if (n.startsWith('danish') || n === 'danish')        choices.push(DANISH_TYPE);
  }

  // ── Platter ──────────────────────────────────────────────────────────────
  else if (category === 'Platter') {
    // All platters get Sauce + Add a Drink
    addons.push(SAUCE, ADD_DRINK);

    // Shrimp / Fish get Make It a Meal!
    if (n.includes('shrimp') || n.includes('fish')) {
      addons.push(MAKE_MEAL);
    }
    // Wings get Wings Extras
    if (n.includes('wings') || n.includes('wing')) {
      addons.push(WINGS_EXTRAS);
    }
    // Tuna / Turkey plates get Extra Meat
    if (n.includes('tuna') || (n.includes('turkey') && !n.includes('bacon'))) {
      addons.push(EXTRA_MEAT);
    }
    // Egg salad plates
    if (n.includes('egg') && (n.includes('salad') || n.includes('berger') || n.includes('hot dog') || n.includes('sausage'))) {
      if      (n.includes('bacon and sausage')) addons.push(EXTRA_EGG_MEAT_5);
      else if (n.includes('hot sausage'))       addons.push(EXTRA_EGG_MEAT_6);
      else if (n.includes('hot dog'))           addons.push(EXTRA_EGG_MEAT_4);
      else if (n.includes('berger'))            addons.push(EXTRA_EGG_MEAT_3);
      else if (n.includes('italian sausage'))   addons.push(EXTRA_EGG_ONLY);
    }
  }

  // ── Sandwich ─────────────────────────────────────────────────────────────
  else if (category === 'Sandwich') {
    // All sandwiches get Sauce
    addons.push(SAUCE);

    // Sandwiches with bread choice
    if (n.includes('berger') && n.includes('egg')) {
      choices.push(BREAD_BURGER, NUM_EGGS);
    } else if ((n.includes('hot dog') || n.includes('sausage')) && n.includes('egg')) {
      choices.push(BREAD_HOTDOG, NUM_EGGS);
    } else if (n.includes('italian sausage') && n.includes('egg')) {
      choices.push(BREAD_PITA_HERO, NUM_EGGS);
    } else if (n.includes('egg') && (n.includes('sandwich') || n.includes('bagel') || n.includes('roll') || n.includes('pita'))) {
      choices.push(BREAD_STANDARD, NUM_EGGS);
      if (n.includes('bacon')) addons.push(DOUBLE_MEAT_3);
      if (n.includes('sausage') && n.includes('cheese')) addons.push(DOUBLE_MEAT_4);
    } else if ((n.includes('tuna') || n.includes('turkey'))) {
      choices.push(BREAD_SMALL);
      addons.push(EXTRA_MEAT);
    } else if (n.includes('bacon') || n.includes('halal bacon')) {
      choices.push(BREAD_STANDARD);
    } else if (n.includes('shrimp') || n.includes('fish fillet')) {
      choices.push(BREAD_STANDARD);
      addons.push(MAKE_MEAL);
    } else if (n.includes('chopped cheese')) {
      choices.push(BREAD_CHOPPED_CHEESE);
    } else if (n.includes('bagel') || n.includes('roll') || n.includes('cream') || n.includes('chesse') || n.includes('butter') || n.includes('better')) {
      choices.push(BREAD_STANDARD);
    } else if (n.includes('shish kebab') || n.includes('shish kebab')) {
      if (n.includes('double') || n.includes('pita')) {
        choices.push({ title: 'Choose Your Bread', options: [
          { title: 'Pita Bread', extra_price: 0.00, is_default: true },
          { title: 'Hero',       extra_price: 1.50 },
        ]});
      }
    }
  }

  // ── Bergers (Burgers) ────────────────────────────────────────────────────
  else if (category === 'Bergers') {
    addons.push(SAUCE);
    if (n.includes('egg') && (n.includes('sandwich') || n.includes('berger')) && !n.includes('salad')) {
      choices.push(BREAD_BURGER, NUM_EGGS);
      addons.push(DOUBLE_MEAT_3);
    } else if (n.includes('egg') && (n.includes('salad') || n.includes('plate'))) {
      addons.push(EXTRA_EGG_MEAT_3);
    }
  }

  // ── Drinks ───────────────────────────────────────────────────────────────
  else if (category === 'Drinks') {
    if (n.includes('canned soda') || n === 'canned soda') choices.push(SODA_FLAVOR);
    else if (n.includes('snapple'))     choices.push(SNAPPLE_FLAVOR);
    else if (n.includes('gatorade'))    choices.push(GATORADE_FLAVOR);
    else if (n.includes('juice') && !n.includes('mix')) choices.push(JUICE_SIZE);
    else if (n.includes('mix juice'))   choices.push(JUICE_SIZE);
    else if (n.includes('ice coffee'))  choices.push(COFFEE_SUGAR, COFFEE_MILK, COFFEE_ICE, COFFEE_SIZE);
    else if (n.includes('hot coffee'))  choices.push(COFFEE_SUGAR, COFFEE_MILK, COFFEE_SIZE);
    else if (n.includes('hot chocolate')) choices.push(COFFEE_SUGAR);
    else if (n === 'tea')               choices.push(TEA_SWEETNESS, TEA_SIZE);
  }

  // ── Extras ───────────────────────────────────────────────────────────────
  else if (category === 'Extras' || category === 'Habibi Specials') {
    if (n.includes('donut') && !n.includes('dozen')) choices.push(DONUT_TYPE);
    else if (n.includes('dozen donuts'))             choices.push(DONUT_TYPE);
    else if (n.startsWith('muffin') || n === 'muffin') choices.push(MUFFIN_TYPE);
    else if (n.startsWith('danish') || n === 'danish') choices.push(DANISH_TYPE);
    else                                             addons.push(SAUCE);
  }

  // ── Family Tray ──────────────────────────────────────────────────────────
  else if (category === 'Family Tray') {
    if (n.includes('dozen donuts'))  choices.push(DONUT_TYPE);
    else if (n.includes('wing'))     choices.push(WINGS_FLAVOR);
    else                             addons.push(SAUCE);
  }

  return {
    choices: buildGroups(choices),
    addons:  buildGroups(addons),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    const { rows: items } = await client.query(
      'SELECT id, name, category FROM menus ORDER BY category, id'
    );
    console.log(`Found ${items.length} menu items to process...\n`);

    let updated = 0;
    let skipped = 0;

    await client.query('BEGIN');

    for (const item of items) {
      const { choices, addons } = resolveModifiers(item.name, item.category);

      if (choices.length === 0 && addons.length === 0) {
        skipped++;
        continue;
      }

      await client.query(
        'UPDATE menus SET choices = $1::jsonb, addons = $2::jsonb WHERE id = $3',
        [JSON.stringify(choices), JSON.stringify(addons), item.id]
      );
      updated++;

      const cLabel = choices.map(c => c.title).join(', ') || '—';
      const aLabel = addons.map(a => a.title).join(', ') || '—';
      console.log(`  ✅ [${String(item.id).padStart(4)}] ${item.name.substring(0, 55).padEnd(55)}`);
      console.log(`       Choices: ${cLabel}`);
      console.log(`       Add-Ons: ${aLabel}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Done — ${updated} items updated, ${skipped} items had no modifiers`);
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
