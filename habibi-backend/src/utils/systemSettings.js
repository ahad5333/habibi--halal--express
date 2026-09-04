const pool = require('../config/db');
const { getUserTier } = require('./loyaltyTiers');

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

async function getFreeDeliveryThreshold(userId) {
  const row = await getSystemSettingsRow();
  const globalThreshold = row.free_delivery_threshold != null
    ? parseFloat(row.free_delivery_threshold)
    : (parseFloat(process.env.FREE_DELIVERY_THRESHOLD) || 50);

  if (!userId) return globalThreshold;

  // A tier's free_delivery_threshold is a perk override -- NULL means "no
  // override, use the global threshold"; 0 means "always free" for that
  // tier. Whichever is lower wins, so a tier perk can only ever help a
  // customer, never require MORE spend than the global default would.
  const tier = await getUserTier(userId).catch(() => null);
  if (!tier || tier.free_delivery_threshold == null) return globalThreshold;
  return Math.min(globalThreshold, parseFloat(tier.free_delivery_threshold));
}

module.exports = { getTaxRate, getServiceFeeRate, getFreeDeliveryThreshold };
