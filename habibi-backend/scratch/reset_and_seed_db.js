const pool = require("../src/config/db");
const models = require("../src/models");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

async function resetAndSeed() {
  try {
    console.log("🚀 Starting database wipe and model synchronization...");
    
    // Force load all models to register them
    const { 
      User, 
      Customer, 
      Location, 
      Category, 
      MenuItem, 
      ChoiceGroup, 
      ChoiceOption, 
      AddonGroup, 
      AddonOption 
    } = models;

    // Drop and sync all tables fresh!
    await pool.sync({ force: true });
    console.log("✅ Database wiped and fresh tables successfully created!");

    // 1. Seed Locations
    console.log("📍 Seeding locations...");
    const brooklyn = await Location.create({
      title: 'Brooklyn Base',
      exact_address: '456 Atlantic Ave, Brooklyn, NY 11217',
      brief_address: '456 Atlantic Ave, Brooklyn',
      latitude: 40.68470000,
      longitude: -73.98130000,
      phone_number: '(718) 555-0202',
      delivery_radius_miles: 4,
      is_active: true,
      preference_level: 1
    });
    
    const manhattan = await Location.create({
      title: 'Manhattan Hub',
      exact_address: '123 Street Food Ave, New York, NY 10001',
      brief_address: '123 Street Food Ave, New York',
      latitude: 40.71277600,
      longitude: -74.00597400,
      phone_number: '(212) 555-0101',
      delivery_radius_miles: 5,
      is_active: true,
      preference_level: 2
    });

    const queens = await Location.create({
      title: 'Queens Corner',
      exact_address: '789 Queens Blvd, Forest Hills, NY 11375',
      brief_address: '789 Queens Blvd, Forest Hills',
      latitude: 40.71810000,
      longitude: -73.84480000,
      phone_number: '(347) 555-0303',
      delivery_radius_miles: 4,
      is_active: true,
      preference_level: 3
    });
    
    const locations = [brooklyn, manhattan, queens];
    console.log("✅ Seeded Brooklyn, Manhattan, and Queens locations!");

    // 2. Parse Menu from Excel
    const excelPath = path.join(__dirname, "..", "..", "habibi-web", "Updated Menu Sheet.xlsx");
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel sheet not found at: ${excelPath}`);
    }

    console.log(`📖 Parsing master menu spreadsheet from ${excelPath}...`);
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    let currentCategory = "Extras";
    const itemsToInsert = [];

    rawData.forEach(row => {
      // Category Header Detection
      if (row.__EMPTY_2 && !row.__EMPTY_1 && !row.__EMPTY_4) {
        const potentialCat = String(row.__EMPTY_2).trim();
        if (!potentialCat.includes("*") && potentialCat !== "Title" && !potentialCat.startsWith("First Group")) {
          currentCategory = potentialCat;
        }
      } else if (row.__EMPTY_2 && row.__EMPTY_1 && row.__EMPTY_4) {
        // Valid Item Detection
        const price = parseFloat(row.__EMPTY_4);
        if (isNaN(price)) return;

        let name = String(row.__EMPTY_2).replace(/^- /, '').trim();
        let description = String(row.__EMPTY_5 || '').trim();
        let imageName = String(row.__EMPTY_3 || '').toLowerCase().trim();
        if (imageName && !imageName.endsWith('.jpg')) {
          imageName += '.jpg';
        }
        let imageUrl = imageName ? `/images/menu/${imageName}` : null;

        // Auto-categorize
        let finalCategory = "Extras";
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes("sandwich") || lowerName.includes("bagel") || lowerName.includes("roll")) finalCategory = "Sandwich";
        else if (lowerName.includes("platter")) finalCategory = "Platter";
        else if (lowerName.includes("taco")) finalCategory = "Tacos";
        else if (lowerName.includes("breakfast") || lowerName.includes("egg") || lowerName.includes("pancake")) finalCategory = "Breakfast";
        else if (lowerName.includes("pizza")) finalCategory = "Pizza";
        else if (lowerName.includes("drink") || lowerName.includes("shake") || lowerName.includes("soda") || lowerName.includes("beverage") || lowerName.includes("coffee") || lowerName.includes("tea") || lowerName.includes("juice")) finalCategory = "Drinks";
        else if (lowerName.includes("salad") || lowerName.includes("sides") || lowerName.includes("hummus")) finalCategory = "Sides";
        else if (lowerName.includes("create") || lowerName.includes("build your own")) finalCategory = "Build Your Own";
        else if (lowerName.includes("burger")) finalCategory = "Burgers";
        else if (currentCategory.toLowerCase().includes("family")) finalCategory = "Family Tray";

        itemsToInsert.push({ name, description, price, category: finalCategory, image_url: imageUrl });
      }
    });

    console.log(`Parsed ${itemsToInsert.length} items from master menu.`);

    // 3. Seed Categories and MenuItems
    console.log("🍳 Populating Categories and Menu Items...");
    const categoryCache = {};

    let menuCount = 0;
    for (const item of itemsToInsert) {
      // Get or create Category
      if (!categoryCache[item.category]) {
        const cat = await Category.create({ name: item.category });
        categoryCache[item.category] = cat.id;
      }
      const categoryId = categoryCache[item.category];

      // Create MenuItem
      const menuItem = await MenuItem.create({
        title: item.name,
        description: item.description,
        price: item.price,
        partner_price: item.price + 1.00, // Partner premium
        image_url: item.image_url,
        category_id: categoryId,
        is_available: true,
        preference: menuCount
      });

      // Link to all 3 locations
      await menuItem.addLocations(locations);
      menuCount++;
    }
    console.log(`...Loaded ${menuCount} menu items and mapped them to all active locations!`);

    // 4. Seed Choice Groups & Add-ons
    console.log("🍔 Creating default Choices & Add-ons...");
    
    // Select Your Bread (Choice Group)
    const sandwiches = await MenuItem.findAll({
      include: [{ model: Category, where: { name: 'Sandwich' } }]
    });

    if (sandwiches.length > 0) {
      // Limit to first 20 to keep the seed fast, or link to all sandwiches
      for (const item of sandwiches) {
        const breadGroup = await ChoiceGroup.create({
          menu_item_id: item.id,
          title: 'Select Your Bread',
          preference: 1
        });

        await ChoiceOption.create({ choice_group_id: breadGroup.id, title: 'Pita Bread', extra_price: 0.00, is_default: true, preference: 1 });
        await ChoiceOption.create({ choice_group_id: breadGroup.id, title: 'Whole Wheat Bread', extra_price: 0.00, is_default: false, preference: 2 });
        await ChoiceOption.create({ choice_group_id: breadGroup.id, title: 'No Bread', extra_price: 0.00, is_default: false, preference: 3 });

        // Add toppings add-on group
        const toppingsGroup = await AddonGroup.create({
          menu_item_id: item.id,
          title: 'Add Extra Toppings',
          preference: 2
        });

        await AddonOption.create({ addon_group_id: toppingsGroup.id, title: 'Extra Meat', price: 3.99, preference: 1 });
        await AddonOption.create({ addon_group_id: toppingsGroup.id, title: 'Extra Sauce', price: 0.50, preference: 2 });
        await AddonOption.create({ addon_group_id: toppingsGroup.id, title: 'White Sauce', price: 0.00, preference: 3 });
      }
      console.log(`✅ Configured default modifier choices for ${sandwiches.length} sandwiches!`);
    }

    // 5. Seed Users
    console.log("👥 Seeding pre-configured default users...");
    
    // Admin User
    const adminUser = await User.create({
      email: 'admin@habibihe.com',
      password_hash: 'admin123',
      role: 'admin',
      is_active: true
    });
    
    // Merchant User
    const merchantUser = await User.create({
      email: 'merchant@habibihe.com',
      password_hash: 'merchant123',
      role: 'merchant',
      is_active: true
    });

    // Customer User
    const customerUser = await User.create({
      email: 'customer@habibihe.com',
      password_hash: 'customer123',
      role: 'customer',
      is_active: true
    });
    
    // Create Customer profile linked to customerUser
    await Customer.create({
      user_id: customerUser.id,
      first_name: 'John',
      last_name: 'Doe'
    });

    console.log("✅ Seeded Admin (admin@habibihe.com), Merchant (merchant@habibihe.com), and Customer (customer@habibihe.com)!");
    console.log("✨ DATABASE SEEDING COMPLETED FLawlessly!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal Seeding Failure:", err);
    process.exit(1);
  }
}

resetAndSeed();
