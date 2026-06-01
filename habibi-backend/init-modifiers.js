const pool = require("./src/config/db");

const initModifiers = async () => {
  try {
    console.log("--- Initializing Menu Modifiers (Choices & Add-ons) ---");

    // Clean slate
    await pool.query("DROP TABLE IF EXISTS menu_item_addon_groups CASCADE");
    await pool.query("DROP TABLE IF EXISTS menu_item_choice_groups CASCADE");
    await pool.query("DROP TABLE IF EXISTS menu_addons CASCADE");
    await pool.query("DROP TABLE IF EXISTS menu_addon_groups CASCADE");
    await pool.query("DROP TABLE IF EXISTS menu_choices CASCADE");
    await pool.query("DROP TABLE IF EXISTS menu_choice_groups CASCADE");

    // 1. Choice Groups
    await pool.query(`
      CREATE TABLE menu_choice_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        min_selection INTEGER DEFAULT 1,
        max_selection INTEGER DEFAULT 1,
        is_required BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Individual Choices
    await pool.query(`
      CREATE TABLE menu_choices (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES menu_choice_groups(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        additional_price DECIMAL(10,2) DEFAULT 0.00,
        is_available BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // 3. Add-on Groups
    await pool.query(`
      CREATE TABLE menu_addon_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        max_selection INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Individual Add-ons
    await pool.query(`
      CREATE TABLE menu_addons (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES menu_addon_groups(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) DEFAULT 0.00,
        is_available BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // 5. Item Mappings
    await pool.query(`
      CREATE TABLE menu_item_choice_groups (
        item_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES menu_choice_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, group_id)
      )
    `);

    await pool.query(`
      CREATE TABLE menu_item_addon_groups (
        item_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES menu_addon_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, group_id)
      )
    `);

    // 6. Seed some default data
    const choiceGroup = await pool.query("INSERT INTO menu_choice_groups (name, min_selection, max_selection) VALUES ('Select Your Bread', 1, 1) RETURNING id");
    const groupId = choiceGroup.rows[0].id;
    await pool.query("INSERT INTO menu_choices (group_id, name) VALUES ($1, 'Pita Bread'), ($1, 'Whole Wheat Bread'), ($1, 'No Bread')", [groupId]);

    const addonGroup = await pool.query("INSERT INTO menu_addon_groups (name, max_selection) VALUES ('Add Extra Toppings', 5) RETURNING id");
    const addGroupId = addonGroup.rows[0].id;
    await pool.query("INSERT INTO menu_addons (group_id, name, price) VALUES ($1, 'Extra Meat', 3.99), ($1, 'Extra Sauce', 0.50), ($1, 'White Sauce', 0.00)", [addGroupId]);

    // Link 'Select Your Bread' choice group to all Sandwiches
    await pool.query(`
      INSERT INTO menu_item_choice_groups (item_id, group_id)
      SELECT id, $1 FROM menus WHERE category = 'Sandwich' ON CONFLICT DO NOTHING
    `, [groupId]);

    // Link 'Add Extra Toppings' addon group to all Sandwiches and Burgers
    await pool.query(`
      INSERT INTO menu_item_addon_groups (item_id, group_id)
      SELECT id, $1 FROM menus WHERE category IN ('Sandwich', 'Burgers') ON CONFLICT DO NOTHING
    `, [addGroupId]);

    console.log("✅ Menu Modifiers initialized and mapped successfully!");
  } catch (err) {
    console.error("❌ Failed to initialize modifiers:", err.message);
  } finally {
    process.exit();
  }
};

initModifiers();
