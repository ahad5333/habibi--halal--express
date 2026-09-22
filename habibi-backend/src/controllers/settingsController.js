const safeError = require('../utils/safeError');
const pool = require("../config/db");
const { logAudit } = require('./auditController');
const { sendSMS, toE164, lookupLineType } = require('../services/smsService');
const { getAlertPhone, clearAlertPhoneCache } = require('../utils/alertPhone');
const { getTaxRate, getServiceFeeRate, getFreeDeliveryThreshold } = require('../utils/systemSettings');
const { normalizeZelleHandle, displayZelleHandle, zelleHandleFromConfig } = require('../utils/zelleHandle');

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

  // tax_rate/service_fee_rate/free_delivery_threshold: previously env-var-only
  // (tax/service fee even shown as "read-only, edit your server .env" on the
  // Settings page) — DB value (if ever set via that page) now takes
  // precedence, env var is the fallback until an admin explicitly changes it.
  const [taxRate, svcFeeRate, freeDeliveryThreshold] = await Promise.all([
    getTaxRate(), getServiceFeeRate(), getFreeDeliveryThreshold(),
  ]);

  // Driver dashboard's daily-deliveries goal -- previously hardcoded to 10
  // in DriverView.jsx with no way for an admin to change it.
  let driverDailyGoal = 10;
  try {
    const goalRes = await pool.query(`SELECT driver_daily_goal FROM system_settings WHERE id = 1`);
    if (goalRes.rows[0]?.driver_daily_goal != null) driverDailyGoal = parseInt(goalRes.rows[0].driver_daily_goal, 10);
  } catch (_) { /* fall back to default above */ }

  res.json({
    tax_rate:                taxRate,
    service_fee_rate:        svcFeeRate,
    delivery_fee:            parseFloat(process.env.DELIVERY_FEE) || 3.99,
    free_delivery_threshold: freeDeliveryThreshold,
    loyalty_earn_rate:       loyaltyEarnRate,
    loyalty_redeem_rate:     loyaltyRedeemRate,
    driver_daily_goal:       driverDailyGoal,
  });
};

const updateSystemSettings = async (req, res) => {
  const { tax_rate, service_fee_rate, free_delivery_threshold, driver_daily_goal } = req.body;
  const taxNum = parseFloat(tax_rate);
  const svcNum = parseFloat(service_fee_rate);
  if (!(taxNum >= 0 && taxNum < 1)) {
    return res.status(400).json({ message: 'Tax rate must be a decimal between 0 and 1 (e.g. 0.08875 for 8.875%).' });
  }
  if (!(svcNum >= 0 && svcNum < 1)) {
    return res.status(400).json({ message: 'Service fee rate must be a decimal between 0 and 1 (e.g. 0.04273 for 4.273%).' });
  }
  // Optional -- omit/blank to leave the free-delivery threshold on whatever
  // it's currently set to (DB override or env fallback) rather than forcing
  // every tax/service-fee save to also touch it.
  let thresholdNum;
  if (free_delivery_threshold !== undefined && free_delivery_threshold !== '') {
    thresholdNum = parseFloat(free_delivery_threshold);
    if (!(thresholdNum >= 0)) {
      return res.status(400).json({ message: 'Free delivery threshold must be a non-negative dollar amount.' });
    }
  }
  // Same optional pattern for the driver dashboard's daily goal.
  let goalNum;
  if (driver_daily_goal !== undefined && driver_daily_goal !== '') {
    goalNum = parseInt(driver_daily_goal, 10);
    if (!(goalNum > 0)) {
      return res.status(400).json({ message: 'Driver daily goal must be a positive whole number.' });
    }
  }
  try {
    await pool.query(
      `UPDATE system_settings
          SET tax_rate = $1, service_fee_rate = $2,
              free_delivery_threshold = COALESCE($3, free_delivery_threshold),
              driver_daily_goal = COALESCE($4, driver_daily_goal),
              updated_at = NOW()
        WHERE id = 1`,
      [taxNum, svcNum, thresholdNum ?? null, goalNum ?? null]
    );
    logAudit(pool, req.user?.id, req.user?.name, 'update_system_settings', 'setting', 'checkout',
      { tax_rate: taxNum, service_fee_rate: svcNum, free_delivery_threshold: thresholdNum, driver_daily_goal: goalNum }, req.ip);
    res.json({ tax_rate: taxNum, service_fee_rate: svcNum, free_delivery_threshold: thresholdNum, driver_daily_goal: goalNum });
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
  // Field name kept for API compatibility, but it now holds any Zelle
  // destination: a US mobile number or an email.
  let zelleHandle = null;
  if (zelle_email !== undefined && zelle_email !== '') {
    zelleHandle = normalizeZelleHandle(zelle_email);
    if (!zelleHandle) {
      return res.status(400).json({
        message: 'Zelle must be a US mobile number (e.g. 347-459-7103) or an email address.',
      });
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
    if (zelle_email !== undefined) {
      // Cleared -> empty config, so the checkout shows "unavailable" rather
      // than inventing an address.
      await upsertHandle('zelle', 'Zelle', zelleHandle ? { type: zelleHandle.type, value: zelleHandle.value } : {});
    }
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
    // No hardcoded fallback: the admin must see "Not set" when nothing is
    // configured, not the invented address customers used to be shown.
    const zh = zelleHandleFromConfig(zelleRow?.config) || normalizeZelleHandle(process.env.ZELLE_EMAIL);
    res.json({
      zelle:   {
        handle: displayZelleHandle(zh),
        copy:   zh ? zh.value : null,
        type:   zh ? zh.type : null,
        email:  zh && zh.type === 'email' ? zh.value : null,
      },
      cashapp: { cashtag: cashappRow?.config?.cashtag || process.env.CASHAPP_CASHTAG || '$HabibiHalal' },
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const SITE_FIELDS = [
  'phone_main','phone_tollfree','phone_fax',
  'email_contact','email_orders',
  'email_customer_service','email_urgent','email_wholesale','email_media',
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

// social_* fields are rendered as raw <a href> on the public site (Footer,
// About) with no scheme check there -- a value like "javascript:..." would
// execute in every visitor's browser when they click the icon. Only an
// admin can set these, but validating here means a compromised/malicious
// admin session can't turn this into a site-wide XSS vector via settings.
const SOCIAL_URL_FIELDS = ['social_instagram', 'social_facebook', 'social_twitter', 'social_tiktok'];
function isSafeHttpUrl(value) {
  if (!value) return true; // clearing the field is fine
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const updateSiteSettings = async (req, res) => {
  const allowed = SITE_FIELDS.filter(f => req.body[f] !== undefined);
  if (!allowed.length) return res.status(400).json({ message: 'No valid fields provided.' });

  for (const f of allowed) {
    // Every email_* value ends up in mailto: links across the site; a typo
    // would silently break them, so refuse anything that isn't an address.
    if (f.startsWith('email_') && !/^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(String(req.body[f]))) {
      return res.status(400).json({ message: `${f} must be a valid email address.` });
    }
    if (SOCIAL_URL_FIELDS.includes(f) && !isSafeHttpUrl(req.body[f])) {
      return res.status(400).json({ message: `${f} must be a valid http(s) URL.` });
    }
  }

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

// ── Owner alert phone (admin only) ──────────────────────────────────
// Who is texted for urgent/SOS reports, unaccepted orders and "no order screen
// open". Private -- see utils/alertPhone.js. Must be a mobile (checked with
// Twilio), and every change texts both the new number and the previous one, so a
// redirected emergency alert can't go unnoticed.
const LINE_LABEL = {
  landline: 'a landline', fixedVoip: 'an internet (VoIP) line', nonFixedVoip: 'an internet (VoIP) line',
  tollFree: 'a toll-free number', pager: 'a pager', voicemail: 'a voicemail line',
  personal: 'a personal-number service', premium: 'a premium-rate number', sharedCost: 'a shared-cost number',
  uan: 'a business line', unknown: 'an unknown line type',
};
const maskPhone = p => (p ? '(***) ***-' + String(p).slice(-4) : 'none');

const getAlertPhoneSetting = async (req, res) => {
  try {
    const r = await pool.query('SELECT owner_alert_phone FROM system_settings WHERE id = 1');
    const saved = r.rows[0]?.owner_alert_phone || null;
    const server = process.env.ADMIN_CPANEL_PHONE || null;
    res.json({ phone: saved || server, source: saved ? 'cpanel' : server ? 'server' : 'none' });
  } catch (err) {
    res.status(500).json({ message: 'Could not load the alert phone.' });
  }
};

const updateAlertPhoneSetting = async (req, res) => {
  const raw = String(req.body?.phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith('1')))) {
    return res.status(400).json({ message: 'Enter a 10-digit US mobile number.' });
  }
  const phone = toE164(raw);
  const lookup = await lookupLineType(phone);
  if (lookup.error) {
    return res.status(502).json({ message: `Could not check that number with the SMS provider (${lookup.error}). Nothing was changed.` });
  }
  if (!lookup.valid) return res.status(400).json({ message: 'That is not a valid phone number. Nothing was changed.' });
  if (lookup.type !== 'mobile') {
    return res.status(400).json({
      message: `That number is ${LINE_LABEL[lookup.type] || 'not a mobile'}, which can't reliably receive texts. Alerts need a mobile number. Nothing was changed.`,
      line_type: lookup.type,
    });
  }
  try {
    const prev = await getAlertPhone();
    await pool.query('UPDATE system_settings SET owner_alert_phone = $1 WHERE id = 1', [phone]);
    clearAlertPhoneCache();
    logAudit(pool, req.user?.id, req.user?.name, 'update_alert_phone', 'setting', 'owner_alert_phone',
      { to: maskPhone(phone), from: maskPhone(prev), line_type: lookup.type }, req.ip);
    const who = req.user?.name || 'an admin';
    const confirm = await sendSMS(phone,
      'Habibi: this phone is now set in CPanel to receive the website alerts (urgent/SOS, orders not accepted, no order screen open). No action needed.');
    if (prev && prev !== phone) {
      sendSMS(prev, `Habibi: website alerts were moved from this phone to ${maskPhone(phone)} by ${who} in CPanel. If that wasn't expected, check CPanel Settings.`)
        .catch(() => {});
    }
    res.json({ phone, source: 'cpanel', line_type: lookup.type, confirmation_sms: confirm?.success ? 'sent' : 'failed' });
  } catch (err) {
    res.status(500).json({ message: 'Could not save the alert phone.' });
  }
};

module.exports = {
  getAlertPhoneSetting,
  updateAlertPhoneSetting,
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
