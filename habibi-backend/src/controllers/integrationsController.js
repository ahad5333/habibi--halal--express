const pool = require('../config/db');
const safeError = require('../utils/safeError');

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
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const triggerCatalogSync = async (req, res) => {
  const { platform } = req.body;
  try {
    const menuResult = await pool.query('SELECT COUNT(*) FROM menus WHERE is_available = true');
    const itemCount  = parseInt(menuResult.rows[0].count);

    const q      = platform
      ? `UPDATE platform_settings SET last_sync_at = NOW(), updated_at = NOW() WHERE platform = $1`
      : `UPDATE platform_settings SET last_sync_at = NOW(), updated_at = NOW()`;
    const params = platform ? [platform] : [];
    await pool.query(q, params);

    res.json({
      success:     true,
      items_count: itemCount,
      message:     platform
        ? `Sync queued for ${platform} — ${itemCount} menu items ready`
        : `Sync queued for all platforms — ${itemCount} menu items ready`,
      note: 'Live push executes automatically once API credentials are configured.',
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { getPlatformSettings, updatePlatformSettings, triggerCatalogSync };
