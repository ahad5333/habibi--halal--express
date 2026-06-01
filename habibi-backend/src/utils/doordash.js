const jwt = require('jsonwebtoken');

const DD_BASE = 'https://openapi.doordash.com';

function isConfigured() {
  return !!(
    (process.env.DOORDASH_DEVELOPER_ID && process.env.DOORDASH_KEY_ID && process.env.DOORDASH_SIGNING_SECRET) ||
    process.env.DOORDASH_DEVELOPER_ID === 'SIMULATED'
  );
}

function buildAuthToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'doordash',
    iss: process.env.DOORDASH_DEVELOPER_ID,
    kid: process.env.DOORDASH_KEY_ID,
    exp: now + 300,
    iat: now,
  };
  const secret = Buffer.from(process.env.DOORDASH_SIGNING_SECRET, 'base64');
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    header: { alg: 'HS256', 'dd-ver': 'DD-JWT-V1', kid: process.env.DOORDASH_KEY_ID },
  });
}

async function ddRequest(path, method = 'GET', body = null) {
  if (!isConfigured()) {
    throw new Error('DoorDash Drive credentials not configured (DOORDASH_DEVELOPER_ID / DOORDASH_KEY_ID / DOORDASH_SIGNING_SECRET)');
  }

  if (process.env.DOORDASH_DEVELOPER_ID === 'SIMULATED') {
    console.log(`[SIMULATION] DoorDash ${method} ${path}`, body);
    return {
      delivery_id: `DD_SIM_${Date.now()}`,
      external_delivery_id: body?.external_delivery_id,
      tracking_url: `https://simulated.doordash.com/track/${Date.now()}`,
      fee: 699,
      delivery_status: 'created'
    };
  }

  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${buildAuthToken()}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${DD_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.field_errors?.[0]?.error || `DoorDash API error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

module.exports = { ddRequest, isConfigured };
