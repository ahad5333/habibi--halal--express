const pool = require('../config/db');
const { feeFromMiles } = require('./googleMaps');

/**
 * Returns the delivery fee in dollars for a given distance.
 * Checks active DB delivery_zones first; falls back to hardcoded tiers
 * only when no zones are configured at all.
 *
 * @param {number} miles - driving distance
 * @param {number|null} locationId - prefer zones linked to this location
 * @returns {number|null} fee in dollars, or null if out of range
 */
async function getFeeForDistance(miles, locationId = null) {
  try {
    // Count active zones so we know whether the admin has configured any
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM delivery_zones WHERE is_active = TRUE`
    );
    const zoneCount = countRes.rows[0].n;

    if (zoneCount === 0) {
      // No zones configured — use hardcoded tiers
      return feeFromMiles(miles);
    }

    // Try location-specific zone first, then global zone
    const zoneRes = await pool.query(
      `SELECT delivery_fee
         FROM delivery_zones
        WHERE is_active = TRUE
          AND $1 >= min_radius_mi
          AND $1 <  max_radius_mi
          AND (location_id = $2 OR location_id IS NULL)
        ORDER BY
          CASE WHEN location_id = $2 THEN 0 ELSE 1 END,
          min_radius_mi ASC
        LIMIT 1`,
      [miles, locationId]
    );

    if (zoneRes.rows.length > 0) {
      return parseFloat(zoneRes.rows[0].delivery_fee);
    }

    // Zones exist but none cover this distance — out of range
    return null;
  } catch {
    // DB error — fall back to hardcoded tiers so orders still work
    return feeFromMiles(miles);
  }
}

module.exports = { getFeeForDistance };
