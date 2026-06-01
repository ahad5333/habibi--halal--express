const pool = require("./src/config/db");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

async function syncMenu() {
  try {
    const excelPath = path.join(__dirname, "..", "habibi media docs", "Menu", "Updated Menu Sheet.xlsx");
    if (!fs.existsSync(excelPath)) {
      console.error(`Excel file not found at: ${excelPath}`);
      process.exit(1);
    }

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

        // Auto-categorize to match Frontend logic
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

    console.log(`Successfully parsed ${itemsToInsert.length} items from Excel.`);

    // Purge old menus completely
    console.log("Wiping existing menus...");
    await pool.query("DELETE FROM order_items");
    await pool.query("DELETE FROM cart_items");
    await pool.query("DELETE FROM menus");

    console.log("Inserting new items into PostgreSQL...");
    let count = 0;
    for (const item of itemsToInsert) {
      await pool.query(
        "INSERT INTO menus (name, description, price, category, image_url) VALUES ($1, $2, $3, $4, $5)",
        [item.name, item.description, item.price, item.category, item.image_url]
      );
      count++;
    }

    console.log(`✅ SYNC COMPLETE: ${count} items added to the database.`);
    console.log("Your frontend will now show the updated results!");

  } catch (err) {
    console.error("Fatal Error syncing menu:", err);
  } finally {
    process.exit();
  }
}

syncMenu();
