const pool = require('../config/db');

// system_settings.id=1 is the single row of DB-overridable checkout knobs.
// A NULL column means "not overridden yet" -- fall back to the env var, same
// convention across all three so a fresh/never-touched deployment behaves
// exactly like it did before this override mechanism existed.
async function getSystemSettingsRow() {
  try {
    const res = await pool.query(
      `SELECT tax_rate, service_fee_rate, free_delivery_threshold FROM system_settings WHERE id = 1`
    );
    return res.rows[0] || {};
  } catch {
    return {};
  }
}

async function getTaxRate() {
  const row = await getSystemSettingsRow();
  if (row.tax_rate != null) return parseFloat(row.tax_rate);
  return parseFloat(process.env.TAX_RATE) || 0.08875;
}

async function getServiceFeeRate() {
  const row = await getSystemSettingsRow();
  if (row.service_fee_rate != null) return parseFloat(row.service_fee_rate);
  return parseFloat(process.env.SERVICE_FEE_RATE) || 0.04273;
}

async function getFreeDeliveryThreshold() {
  const row = await getSystemSettingsRow();
  if (row.free_delivery_threshold != null) return parseFloat(row.free_delivery_threshold);
  return parseFloat(process.env.FREE_DELIVERY_THRESHOLD) || 50;
}

module.exports = { getTaxRate, getServiceFeeRate, getFreeDeliveryThreshold };
