const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { syncMenuToPlatform } = require('../services/menuTransformService');
const { logAudit } = require('./auditController');

const getPlatformSettings = async (req, res) => {
  try {
    const [settings, stats, menuCount] = await Promise.all([
      pool.query('SELECT * FROM platform_settings ORDER BY id'),
      pool.query(`
        SELECT platform,
               COUNT(*)::int                    AS order_count,
               COUNT(*) FILTER (WHERE status='new')::int AS pending_count,
               COALESCE(SUM(total), 0)::numeric AS gross_revenue
        FROM marketplace_orders
        GROUP BY platform
      `),
      pool.query('SELECT COUNT(*) FROM menus WHERE is_available = true'),
    ]);

    const statsMap = {};
    stats.rows.forEach(s => { statsMap[s.platform] = s; });

    const result = settings.rows.map(p => {
      const s = statsMap[p.platform] || {};
      const gross = parseFloat(s.gross_revenue || 0);
      return {
        ...p,
        commission_rate: parseFloat(p.commission_rate),
        order_count:     parseInt(s.order_count   || 0),
        pending_count:   parseInt(s.pending_count || 0),
        gross_revenue:   gross,
        net_revenue:     parseFloat((gross * (1 - p.commission_rate / 100)).toFixed(2)),
      };
    });

    res.json({ platforms: result, menu_item_count: parseInt(menuCount.rows[0].count) });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updatePlatformSettings = async (req, res) => {
  const { platform } = req.params;
  const { commission_rate, is_active, api_key_set, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE platform_settings
       SET commission_rate = COALESCE($1, commission_rate),
           is_active       = COALESCE($2, is_active),
           api_key_set     = COALESCE($3, api_key_set),
           notes           = COALESCE($4, notes),
           updated_at      = NOW()
       WHERE platform = $5
       RETURNING *`,
      [commission_rate ?? null, is_active ?? null, api_key_set ?? null, notes ?? null, platform]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Platform not found' });
    logAudit(pool, req.user?.id, req.user?.name, 'update_platform_settings', 'platform_sync', platform,
      { commission_rate: commission_rate ?? undefined }, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Previously a no-op: it only touched last_sync_at and returned a canned
// "Sync queued... executes automatically once API credentials are
// configured" message, regardless of whether anything was ever actually
// pushed. The "Sync Menu"/"Sync All Platforms" buttons had looked like they
// worked since day one without ever calling the real platform APIs — the
// only genuine sync path was the per-location "Sync" button on the Platform
// Credentials page (triggerMenuSync), which nothing here reused.
// This restaurant has multiple physical locations, each with its own store
// listing per platform (platform_location_mappings), so "sync" here means
// pushing the current menu to every active, mapped location for the given
// platform (or every platform, if none is specified).
const triggerCatalogSync = async (req, res) => {
  const { platform } = req.body; // optional — omit to sync every platform
  try {
    const platformRows = platform
      ? [{ platform }]
      : (await pool.query('SELECT platform FROM platform_settings ORDER BY id')).rows;

    const results = [];
    for (const { platform: p } of platformRows) {
      const mappings = await pool.query(
        `SELECT location_id, platform_store_id, platform_restaurant_id
           FROM platform_location_mappings
          WHERE platform = $1 AND is_active = TRUE
            AND (platform_store_id IS NOT NULL OR platform_restaurant_id IS NOT NULL)`,
        [p]
      );
      if (mappings.rows.length === 0) {
        results.push({ platform: p, location_id: null, success: false, reason: 'No active location mapping configured — set one in Platform Credentials → Location Mapping first.' });
        continue;
      }
      for (const m of mappings.rows) {
        const storeId = m.platform_store_id || m.platform_restaurant_id;
        const result = await syncMenuToPlatform(p, storeId);
        results.push({ platform: p, location_id: m.location_id, ...result });
      }
    }

    const successResults = results.filter(r => r.success);
    if (successResults.length > 0) {
      const syncedPlatforms = [...new Set(successResults.map(r => r.platform))];
      await pool.query(
        `UPDATE platform_settings SET last_sync_at = NOW(), updated_at = NOW() WHERE platform = ANY($1::text[])`,
        [syncedPlatforms]
      );
    }

    const menuResult = await pool.query('SELECT COUNT(*) FROM menus WHERE is_available = true');
    const itemCount  = parseInt(menuResult.rows[0].count);
    const failCount  = results.length - successResults.length;

    logAudit(pool, req.user?.id, req.user?.name, 'sync_catalog', 'platform_sync', platform || 'all',
      { platform: platform || 'all', synced: successResults.length, failed: failCount }, req.ip);

    res.json({
      success:     successResults.length > 0,
      items_count: itemCount,
      synced:      successResults.length,
      failed:      failCount,
      results,
      message: successResults.length > 0
        ? `Synced ${itemCount} menu item${itemCount !== 1 ? 's' : ''} to ${successResults.length} location${successResults.length !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`
        : (results[0]?.reason || 'No locations to sync.'),
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { getPlatformSettings, updatePlatformSettings, triggerCatalogSync };
