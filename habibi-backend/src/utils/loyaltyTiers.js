const pool = require('../config/db');

// Reads the admin-configurable tier ladder, ordered lowest to highest.
async function getTiers() {
  const res = await pool.query(
    `SELECT id, name, min_points, color, earn_multiplier, discount_pct, free_delivery_threshold
       FROM loyalty_tiers
      ORDER BY min_points ASC`
  );
  return res.rows;
}

// Pure: the highest tier whose min_points a customer's lifetime points meet.
// Assumes tiers is ordered lowest to highest (as getTiers returns). Falls
// back to the lowest tier if lifetimePoints is somehow below every threshold.
function resolveTier(lifetimePoints, tiers) {
  if (!tiers.length) return null;
  let tier = tiers[0];
  for (const t of tiers) {
    if (lifetimePoints >= t.min_points) tier = t;
  }
  return tier;
}

// Looks up a user's real tier from their lifetime (never-decremented) points
// balance -- null for guests/no account, since tier perks are a logged-in-
// customer benefit only.
async function getUserTier(userId) {
  if (!userId) return null;
  const userRes = await pool.query(
    `SELECT lifetime_loyalty_points FROM users WHERE id = $1`,
    [userId]
  );
  if (!userRes.rows[0]) return null;
  const tiers = await getTiers();
  return resolveTier(userRes.rows[0].lifetime_loyalty_points || 0, tiers);
}

module.exports = { getTiers, resolveTier, getUserTier };
