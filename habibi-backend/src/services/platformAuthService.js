const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');

// Reads live credentials from platform_settings.credentials column, falling back to env vars.
async function getCreds(platform) {
  try {
    const r = await pool.query('SELECT credentials FROM platform_settings WHERE platform=$1', [platform]);
    return r.rows[0]?.credentials || {};
  } catch (_) { return {}; }
}

class PlatformAuthService {
  constructor() {
    this._uberToken  = null;
    this._uberExpiry = 0;
  }

  // ── UberEats: OAuth 2.0 client_credentials ────────────────────────
  async getUberEatsToken() {
    if (this._uberToken && Date.now() < this._uberExpiry - 60000) return this._uberToken;

    const db           = await getCreds('ubereats');
    const clientId     = db.client_id     || process.env.UBEREATS_CLIENT_ID;
    const clientSecret = db.client_secret || process.env.UBEREATS_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const cred = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    try {
      const res = await fetch('https://login.uber.com/oauth/v2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${cred}` },
        body:    'grant_type=client_credentials&scope=eats.order%20eats.store',
      });
      if (!res.ok) { console.error('[UberEats Auth] Token fetch failed:', res.status); return null; }
      const data           = await res.json();
      this._uberToken      = data.access_token;
      this._uberExpiry     = Date.now() + data.expires_in * 1000;
      return this._uberToken;
    } catch (err) { console.error('[UberEats Auth]', err.message); return null; }
  }

  // ── DoorDash: JWT HS256 ───────────────────────────────────────────
  async getDoorDashJWT() {
    const db          = await getCreds('doordash');
    const developerId = db.developer_id   || process.env.DOORDASH_DEVELOPER_ID;
    const keyId       = db.key_id         || process.env.DOORDASH_KEY_ID;
    const secret      = db.signing_secret || process.env.DOORDASH_SIGNING_SECRET;
    if (!developerId || !keyId || !secret) return null;

    const payload = { aud: 'doordash', iss: developerId, kid: keyId, exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000) };
    try { return jwt.sign(payload, Buffer.from(secret, 'base64'), { algorithm: 'HS256' }); }
    catch (err) { console.error('[DoorDash JWT]', err.message); return null; }
  }

  // ── GrubHub: Basic auth ───────────────────────────────────────────
  async getGrubHubHeaders() {
    const db       = await getCreds('grubhub');
    const username = db.username || process.env.GRUBHUB_USERNAME;
    const password = db.password || process.env.GRUBHUB_PASSWORD;
    if (!username || !password) return null;
    return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, 'Content-Type': 'application/json' };
  }

  async getGrubHubRestaurantId(locationPlatformId) {
    const db = await getCreds('grubhub');
    return locationPlatformId || db.restaurant_id || process.env.GRUBHUB_RESTAURANT_ID || null;
  }

  // Invalidate cached UberEats token (call after credential update)
  invalidateUberToken() { this._uberToken = null; this._uberExpiry = 0; }
}

module.exports = new PlatformAuthService();
