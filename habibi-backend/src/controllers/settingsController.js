const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { logAudit } = require('./auditController');

const getPaymentSettings = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payment_settings WHERE is_active=TRUE ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getAdminPaymentSettings = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM payment_settings ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updatePaymentSetting = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ message: 'is_active must be a boolean.' });
  }
  try {
    const result = await pool.query(
      "UPDATE payment_settings SET is_active=$1 WHERE id=$2 RETURNING *",
      [is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Payment method not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getCheckoutSettings = async (req, res) => {
  // loyalty_earn_rate/redeem_rate come from the Loyalty Program admin page's
  // "Configure Rates" panel — previously the checkout page hardcoded a 100
  // pts = $1 redemption rate regardless of that setting, so changing it there
  // had no real effect on what customers could actually redeem.
  let loyaltyEarnRate = 10, loyaltyRedeemRate = 100;
  try {
    const cfg = await pool.query(`SELECT earn_rate, redeem_rate FROM loyalty_config WHERE id = 1`);
    if (cfg.rows[0]) {
      loyaltyEarnRate   = parseFloat(cfg.rows[0].earn_rate)   || loyaltyEarnRate;
      loyaltyRedeemRate = parseFloat(cfg.rows[0].redeem_rate) || loyaltyRedeemRate;
    }
  } catch (_) { /* fall back to defaults above */ }

  // tax_rate/service_fee_rate: previously env-var-only and shown as
  // "read-only, edit your server .env" on the Settings page — DB value (if
  // ever set via that page) now takes precedence, env var is the fallback
  // until an admin explicitly changes it. NULL means "not overridden yet".
  let taxRate    = parseFloat(process.env.TAX_RATE)         || 0.08875;
  let svcFeeRate = parseFloat(process.env.SERVICE_FEE_RATE) || 0.04273;
  try {
    const sys = await pool.query(`SELECT tax_rate, service_fee_rate FROM system_settings WHERE id = 1`);
    if (sys.rows[0]?.tax_rate != null)         taxRate    = parseFloat(sys.rows[0].tax_rate);
    if (sys.rows[0]?.service_fee_rate != null) svcFeeRate = parseFloat(sys.rows[0].service_fee_rate);
  } catch (_) { /* fall back to env above */ }

  res.json({
    tax_rate:                taxRate,
    service_fee_rate:        svcFeeRate,
    delivery_fee:            parseFloat(process.env.DELIVERY_FEE)            || 3.99,
    free_delivery_threshold: parseFloat(process.env.FREE_DELIVERY_THRESHOLD) || 50,
    loyalty_earn_rate:       loyaltyEarnRate,
    loyalty_redeem_rate:     loyaltyRedeemRate,
  });
};

const updateSystemSettings = async (req, res) => {
  const { tax_rate, service_fee_rate } = req.body;
  const taxNum = parseFloat(tax_rate);
  const svcNum = parseFloat(service_fee_rate);
  if (!(taxNum >= 0 && taxNum < 1)) {
    return res.status(400).json({ message: 'Tax rate must be a decimal between 0 and 1 (e.g. 0.08875 for 8.875%).' });
  }
  if (!(svcNum >= 0 && svcNum < 1)) {
    return res.status(400).json({ message: 'Service fee rate must be a decimal between 0 and 1 (e.g. 0.04273 for 4.273%).' });
  }
  try {
    await pool.query(
      `UPDATE system_settings SET tax_rate = $1, service_fee_rate = $2, updated_at = NOW() WHERE id = 1`,
      [taxNum, svcNum]
    );
    logAudit(pool, req.user?.id, req.user?.name, 'update_system_settings', 'setting', 'checkout',
      { tax_rate: taxNum, service_fee_rate: svcNum }, req.ip);
    res.json({ tax_rate: taxNum, service_fee_rate: svcNum });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const getIntegrationStatus = (req, res) => {
  res.json([
    { name: 'Square Payments',  status: !!process.env.SQUARE_ACCESS_TOKEN   ? 'configured' : 'pending', detail: !!process.env.SQUARE_ACCESS_TOKEN   ? 'API key configured'        : 'Add SQUARE_ACCESS_TOKEN to .env'   },
    { name: 'Twilio SMS',       status: !!process.env.TWILIO_ACCOUNT_SID     ? 'configured' : 'pending', detail: !!process.env.TWILIO_ACCOUNT_SID     ? 'Credentials active'        : 'Add TWILIO_* credentials to .env'  },
    { name: 'DoorDash Drive',   status: !!process.env.DOORDASH_DEVELOPER_ID  ? 'configured' : 'pending', detail: !!process.env.DOORDASH_DEVELOPER_ID  ? 'Webhook active'            : 'Add DOORDASH_* credentials to .env'},
    { name: 'Uber Eats',        status: !!process.env.UBER_CLIENT_ID         ? 'configured' : 'pending', detail: !!process.env.UBER_CLIENT_ID         ? 'Webhook active'            : 'Add UBER_* credentials to .env'    },
    { name: 'FCM Push',         status: !!process.env.FIREBASE_PROJECT_ID    ? 'configured' : 'pending', detail: !!process.env.FIREBASE_PROJECT_ID    ? 'Push notifications active' : 'Add FIREBASE_* credentials to .env' },
  ]);
};

// ── Admin: upsert Zelle email + Cash App cashtag into payment_settings ──
const updateOfflineHandles = async (req, res) => {
  const { zelle_email, cashapp_cashtag } = req.body;

  if (zelle_email !== undefined && zelle_email !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zelle_email)) {
      return res.status(400).json({ message: 'Zelle email must be a valid email address' });
    }
  }
  if (cashapp_cashtag !== undefined && cashapp_cashtag !== '') {
    if (!cashapp_cashtag.startsWith('$')) {
      return res.status(400).json({ message: 'Cash App cashtag must start with $ (e.g. $HabibiHalal)' });
    }
  }

  async function upsertHandle(provider, label, config) {
    const existing = await pool.query(
      `SELECT id FROM payment_settings WHERE provider = $1 LIMIT 1`, [provider]
    );
    if (existing.rows.length) {
      await pool.query(
        `UPDATE payment_settings SET config = $1, label = $2 WHERE provider = $3`,
        [JSON.stringify(config), label, provider]
      );
    } else {
      await pool.query(
        `INSERT INTO payment_settings (label, provider, is_active, config) VALUES ($1,$2,TRUE,$3)`,
        [label, provider, JSON.stringify(config)]
      );
    }
  }

  try {
    if (zelle_email !== undefined)    await upsertHandle('zelle',   'Zelle',    { email: zelle_email });
    if (cashapp_cashtag !== undefined) await upsertHandle('cashapp', 'Cash App', { cashtag: cashapp_cashtag });

    const result = await pool.query(
      `SELECT * FROM payment_settings WHERE provider IN ('zelle','cashapp') ORDER BY provider`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// ── Public: get Zelle / CashApp handles from DB (with env fallback) ─
const getOfflineHandles = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT provider, config FROM payment_settings WHERE provider IN ('zelle','cashapp')`
    );
    const rows = result.rows;
    const zelleRow   = rows.find(r => r.provider === 'zelle');
    const cashappRow = rows.find(r => r.provider === 'cashapp');
    res.json({
      zelle:   { email:   zelleRow?.config?.email   || process.env.ZELLE_EMAIL      || 'payments@habibihalal.com' },
      cashapp: { cashtag: cashappRow?.config?.cashtag || process.env.CASHAPP_CASHTAG || '$HabibiHalal' },
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const SITE_FIELDS = [
  'phone_main','phone_tollfree','phone_fax',
  'email_contact','email_orders',
  'address_street','address_city','address_state','address_zip',
  'social_instagram','social_facebook','social_twitter','social_tiktok',
];

const getSiteSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM site_settings WHERE id=1');
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateSiteSettings = async (req, res) => {
  const allowed = SITE_FIELDS.filter(f => req.body[f] !== undefined);
  if (!allowed.length) return res.status(400).json({ message: 'No valid fields provided.' });

  const sets = allowed.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const vals = allowed.map(f => req.body[f]);

  try {
    const result = await pool.query(
      `UPDATE site_settings SET ${sets}, updated_at = NOW() WHERE id = 1 RETURNING *`,
      vals
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getPaymentSettings,
  getAdminPaymentSettings,
  updatePaymentSetting,
  updateOfflineHandles,
  getOfflineHandles,
  getCheckoutSettings,
  updateSystemSettings,
  getIntegrationStatus,
  getSiteSettings,
  updateSiteSettings,
};
