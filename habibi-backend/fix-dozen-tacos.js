require("dotenv").config();
const pool = require("./src/config/db");

async function fix() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Activate the 12-taco builder on the canonical 'Dozen Tacos' item (inserted by deploy-menus.js)
    await client.query("UPDATE menus SET quota_required = 12 WHERE id = 1215");
    console.log("✅ Set quota_required = 12 on 'Dozen Tacos' (id 1215)");

    // Deactivate the old duplicate 'Dozen of Tacos' — replaced by id 1215
    await client.query("UPDATE menus SET is_active = false, is_available = false WHERE id = 1123");
    console.log("✅ Deactivated old 'Dozen of Tacos' (id 1123)");

    // Deactivate stale '(Halal)' taco items — clean-name versions now exist in the Tacos category
    // Kept: Shrimp Taco (1105) and Falafel Taco (1108) — these have no duplicates
    const staleHalalIds = [1101, 1102, 1103, 1104, 1106, 1107];
    await client.query(
      "UPDATE menus SET is_active = false, is_available = false WHERE id = ANY($1)",
      [staleHalalIds]
    );
    console.log("✅ Deactivated 6 stale (Halal)-suffix taco duplicates");

    await client.query("COMMIT");
    console.log("\n✅ Done — Dozen Tacos builder is now live");
    process.exit(0);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

fix();
