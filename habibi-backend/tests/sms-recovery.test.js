// Phone password recovery -> choose a new password (npm run test:recovery).
// Local database; texts are captured instead of sent; cleans up after itself.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const ROOT = require('path').join(__dirname, '..');
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';

const sent = [];
const smsPath = require.resolve(ROOT + '/src/services/smsService');
require.cache[smsPath] = { id: smsPath, filename: smsPath, loaded: true, exports: {
  sendSMS: async (to, body) => { sent.push({ to, body }); return { sid: 'test' }; },
  smsConfigured: () => true,
} };

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const pool = require(ROOT + '/src/config/db');
const createTables = require(ROOT + '/src/config/init');

const PHONE = '2125550111';
const EMAIL = 'recoverytest@example.com';
let failed = 0;
const ok = (cond, label) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${label}`); if (!cond) failed++; };
const lastCode = () => (sent[sent.length - 1]?.body.match(/\b(\d{5})\b/) || [])[1];
const cleanup = () => pool.query(`DELETE FROM users WHERE email = $1`, [EMAIL]);

(async () => {
  await createTables();
  await cleanup();
  await pool.query(`INSERT INTO users (name, email, password_hash, phone_number, email_verified) VALUES ('Rec', $1, $2, $3, TRUE)`,
    [EMAIL, await bcrypt.hash('OldPassword1', 10), PHONE]);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', require(ROOT + '/src/routes/authRoutes'));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body, token) => {
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };

  try {
    ok((await call('/api/auth/sms-recovery/set-password', { password: 'NewPassword1' })).status === 401, 'needs a session');
    const login = await call('/api/auth/login', { email: EMAIL, password: 'OldPassword1' });
    ok((await call('/api/auth/sms-recovery/set-password', { password: 'NewPassword1' }, login.data.token)).status === 403, 'a normal session cannot set a password this way');

    await call('/api/auth/sms-recovery/send', { phone: PHONE });
    const v = await call('/api/auth/sms-recovery/verify', { phone: PHONE, code: lastCode() });
    ok(v.status === 200 && v.data.token, 'recovery code signs in');
    const rec = v.data.token;
    ok((await call('/api/auth/sms-recovery/set-password', { password: 'short1' }, rec)).status === 400, 'too short refused');
    ok((await call('/api/auth/sms-recovery/set-password', { password: 'NoNumbersHere' }, rec)).status === 400, 'needs a number');
    const set = await call('/api/auth/sms-recovery/set-password', { password: 'NewPassword1' }, rec);
    ok(set.status === 200 && set.data.token && set.data.token !== rec, 'new password set, normal session issued');
    ok((await call('/api/auth/sms-recovery/set-password', { password: 'Another1pass' }, rec)).status === 401, 'recovery token is single-use');
    ok((await call('/api/auth/login', { email: EMAIL, password: 'NewPassword1' })).status === 200, 'signs in with the new password');
    ok((await call('/api/auth/login', { email: EMAIL, password: 'OldPassword1' })).status === 400, 'old password no longer works');
    const row = (await pool.query('SELECT password_set FROM users WHERE email = $1', [EMAIL])).rows[0];
    ok(row.password_set === true, 'password_set marked TRUE');
  } catch (e) {
    failed++; console.error('CRASH', e);
  } finally {
    await cleanup();
    server.close();
    await pool.end();
    console.log(failed ? `\n${failed} FAILED` : '\nall passed');
    process.exit(failed ? 1 : 0);
  }
})();
