const pool = require('../config/db');

// The owner's alert number -- where urgent/SOS reports, orders left unaccepted
// and "no order screen open" warnings are texted. Set in CPanel (Settings ->
// Owner alert phone, stored in system_settings.owner_alert_phone), with the
// server's ADMIN_CPANEL_PHONE as the fallback.
//
// Safety-critical: SOS alerts go through this, so it never throws, and a
// database problem falls back to the server value rather than to nothing.
//
// It is a personal mobile number, so it lives in system_settings -- read only by
// named columns -- and never in site_settings, which is served publicly with
// SELECT *.
//
// Cached for a minute so a burst of alerts doesn't query each time. Saving in
// CPanel clears the cache on the worker that saved; the other PM2 worker picks
// the change up within CACHE_MS.
const CACHE_MS = 60 * 1000;
let cached = null;    // '' = no CPanel value (use the server's); null = not loaded
let cachedAt = 0;

async function getAlertPhone() {
  const fallback = process.env.ADMIN_CPANEL_PHONE || null;
  if (cached !== null && Date.now() - cachedAt < CACHE_MS) return cached || fallback;
  try {
    const r = await pool.query('SELECT owner_alert_phone FROM system_settings WHERE id = 1');
    cached = r.rows[0]?.owner_alert_phone || '';
    cachedAt = Date.now();
    return cached || fallback;
  } catch (err) {
    console.error('[ALERT PHONE] could not read the CPanel setting, using the server value:', err.message);
    return fallback;
  }
}

function clearAlertPhoneCache() {
  cached = null;
  cachedAt = 0;
}

module.exports = { getAlertPhone, clearAlertPhoneCache };
