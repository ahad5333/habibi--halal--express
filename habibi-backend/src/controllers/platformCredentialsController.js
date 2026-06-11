const pool         = require('../config/db');
const safeError    = require('../utils/safeError');
const platformAuth = require('../services/platformAuthService');
const { syncMenuToPlatform, getMenuPreview } = require('../services/menuTransformService');
const { encryptObject, decryptObject } = require('../utils/encrypt');

// ── Credentials ─────────────────────────────────────────────────────
const getCredentials = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT platform, display_name, credentials, is_active, api_key_set, last_sync_at FROM platform_settings ORDER BY id'
    );
    // Mask actual values — only expose whether each key is set
    const rows = result.rows.map(row => {
      const raw    = decryptObject(row.credentials || {});
      const masked = {};
      for (const [key, val] of Object.entries(raw)) {
        if (val && String(val).length > 0) {
          const s = String(val);
          masked[key] = { set: true, preview: s.length > 6 ? `****${s.slice(-4)}` : '****' };
        } else {
          masked[key] = { set: false };
        }
      }
      return { ...row, credentials: masked };
    });
    res.json(rows);
  } catch (err) { res.status(500).json(safeError(err)); }
};

const updateCredentials = async (req, res) => {
  const { platform } = req.params;
  const incoming     = req.body.credentials || {};
  try {
    const existing = await pool.query('SELECT credentials FROM platform_settings WHERE platform=$1', [platform]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Platform not found' });

    // Merge: only overwrite keys that have a non-empty value in the request
    const current = decryptObject(existing.rows[0].credentials || {});
    const merged  = { ...current };
    for (const [k, v] of Object.entries(incoming)) {
      if (v !== null && v !== undefined && v !== '') merged[k] = v;
    }
    const hasKeys = Object.values(merged).some(v => v && String(v).length > 4);

    // Encrypt before persisting
    const encrypted = encryptObject(merged);
    await pool.query(
      `UPDATE platform_settings SET credentials=$1, api_key_set=$2, updated_at=NOW() WHERE platform=$3`,
      [JSON.stringify(encrypted), hasKeys, platform]
    );

    // Invalidate cached tokens so next request re-authenticates with new creds
    if (platform === 'ubereats') platformAuth.invalidateUberToken();

    res.json({ success: true, api_key_set: hasKeys });
  } catch (err) { res.status(500).json(safeError(err)); }
};

// ── Location Mappings ────────────────────────────────────────────────
const getLocationMappings = async (req, res) => {
  try {
    const [mappings, locations, platforms] = await Promise.all([
      pool.query(`
        SELECT plm.*, l.title AS location_name, l.brief_address
        FROM platform_location_mappings plm
        JOIN locations l ON l.id = plm.location_id
        ORDER BY plm.location_id, plm.platform
      `),
      pool.query('SELECT id, title, brief_address FROM locations WHERE is_active=true ORDER BY preference_level DESC'),
      pool.query('SELECT platform, display_name FROM platform_settings ORDER BY id'),
    ]);
    res.json({ mappings: mappings.rows, locations: locations.rows, platforms: platforms.rows });
  } catch (err) { res.status(500).json(safeError(err)); }
};

const upsertLocationMapping = async (req, res) => {
  const { location_id, platform, platform_store_id, platform_restaurant_id, platform_menu_id, is_active } = req.body;
  if (!location_id || !platform) return res.status(400).json({ message: 'location_id and platform are required' });
  try {
    const result = await pool.query(
      `INSERT INTO platform_location_mappings
         (location_id, platform, platform_store_id, platform_restaurant_id, platform_menu_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (location_id, platform) DO UPDATE
         SET platform_store_id      = EXCLUDED.platform_store_id,
             platform_restaurant_id = EXCLUDED.platform_restaurant_id,
             platform_menu_id       = EXCLUDED.platform_menu_id,
             is_active              = EXCLUDED.is_active,
             updated_at             = NOW()
       RETURNING *`,
      [location_id, platform, platform_store_id || null, platform_restaurant_id || null, platform_menu_id || null, is_active ?? false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json(safeError(err)); }
};

// ── Menu Sync ────────────────────────────────────────────────────────
const triggerMenuSync = async (req, res) => {
  const { platform, location_id } = req.body;
  if (!platform || !location_id) return res.status(400).json({ message: 'platform and location_id required' });
  try {
    const mapping = await pool.query(
      'SELECT * FROM platform_location_mappings WHERE platform=$1 AND location_id=$2',
      [platform, location_id]
    );
    const row     = mapping.rows[0];
    const storeId = row?.platform_store_id || row?.platform_restaurant_id;
    if (!storeId) return res.status(400).json({ message: 'No store ID configured for this location + platform. Set it in Location Mapping first.' });

    const result = await syncMenuToPlatform(platform, storeId);
    if (result.success) {
      await pool.query('UPDATE platform_settings SET last_sync_at=NOW(), updated_at=NOW() WHERE platform=$1', [platform]);
    }
    res.json(result);
  } catch (err) { res.status(500).json(safeError(err)); }
};

const getMenuPreviewForPlatform = async (req, res) => {
  const { platform } = req.params;
  try {
    const menu = await getMenuPreview(platform);
    if (!menu) return res.status(400).json({ message: 'Unknown platform' });
    const count = await pool.query('SELECT COUNT(*) FROM menus WHERE is_available=true');
    res.json({ platform, item_count: parseInt(count.rows[0].count), menu });
  } catch (err) { res.status(500).json(safeError(err)); }
};

module.exports = {
  getCredentials,
  updateCredentials,
  getLocationMappings,
  upsertLocationMapping,
  triggerMenuSync,
  getMenuPreviewForPlatform,
};
