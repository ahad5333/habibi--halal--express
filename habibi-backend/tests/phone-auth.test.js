// Phone sign-in end to end against the local database (npm run test:phone).
// Texts are captured instead of sent. Uses 212-555-01xx numbers and removes
// everything it created.
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
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require(ROOT + '/src/config/db');
const createTables = require(ROOT + '/src/config/init');

const P = { a: '2125550101', b: '2125550102', c: '2125550103', d: '2125550104' };
let failed = 0;
const ok = (cond, label) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${label}`); if (!cond) failed++; };
const lastCode = () => (sent[sent.length - 1]?.body.match(/\b(\d{6})\b/) || [])[1];

async function cleanup() {
  await pool.query(`DELETE FROM users WHERE right(regexp_replace(coalesce(phone_number,''), '[^0-9]', '', 'g'), 10) = ANY($1)
                     OR email LIKE 'phone_212555010%@habibi.internal' OR email = 'phonetest@example.com'`, [Object.values(P)]);
  await pool.query(`DELETE FROM users WHERE email LIKE 'deleted_%@habibi.removed' AND name = 'Deleted User' AND created_at > NOW() - interval '1 hour'`);
  await pool.query(`DELETE FROM phone_login_codes WHERE phone = ANY($1)`, [Object.values(P)]);
}
const allowResend = phone => pool.query(`UPDATE phone_login_codes SET last_sent_at = NOW() - interval '2 minutes' WHERE phone = $1`, [phone]);

(async () => {
  await createTables();
  await cleanup();
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/auth', require(ROOT + '/src/routes/authRoutes'));
  app.use('/api/users', require(ROOT + '/src/routes/userRoutes'));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };

  try {
    console.log('start');
    ok((await call('POST', '/api/auth/phone/start', { phone: '0125550101' })).status === 400, 'bad number refused');
    let r = await call('POST', '/api/auth/phone/start', { phone: '(212) 555-0101' });
    ok(r.status === 200 && sent.length === 1 && sent[0].to === '+12125550101', 'code texted to +1 number');
    const code1 = lastCode();
    ok((await call('POST', '/api/auth/phone/start', { phone: P.a })).status === 429, 'second code within 60 s refused');

    console.log('verify + new account');
    ok((await call('POST', '/api/auth/phone/verify', { phone: P.a, code: code1 === '000000' ? '111111' : '000000' })).status === 400, 'wrong code refused');
    r = await call('POST', '/api/auth/phone/verify', { phone: P.a, code: code1 });
    ok(r.status === 200 && r.data.new_user && r.data.signup_ticket && !r.data.token, 'unknown number -> sign-up ticket, no token');
    const ticket = r.data.signup_ticket;
    ok((await call('GET', '/api/users/me', null, ticket)).status === 401, 'ticket is not a session token');
    ok((await call('POST', '/api/auth/phone/verify', { phone: P.a, code: code1 })).status === 400, 'code is single-use');
    ok((await call('POST', '/api/auth/phone/complete', { signup_ticket: ticket, name: 'Pat' })).status === 400, 'terms required');
    ok((await call('POST', '/api/auth/phone/complete', { signup_ticket: 'junk', name: 'Pat', agree_terms: true })).status === 400, 'forged ticket refused');
    r = await call('POST', '/api/auth/phone/complete', { signup_ticket: ticket, name: 'Pat', agree_terms: true, sms_consent: true });
    ok(r.status === 201 && r.data.token && r.data.user.phone === P.a, 'account created + signed in');
    const t1 = jwt.decode(r.data.token);
    ok(t1.exp - t1.iat === 30 * 86400, 'app session is 30 days');
    ok((await call('POST', '/api/auth/phone/complete', { signup_ticket: ticket, name: 'Pat', agree_terms: true })).status === 409, 'ticket cannot make a second account');

    console.log('returning customer');
    await allowResend(P.a);
    await call('POST', '/api/auth/phone/start', { phone: P.a });
    r = await call('POST', '/api/auth/phone/verify', { phone: '+1 212 555 0101', code: lastCode() });
    ok(r.status === 200 && r.data.token && r.data.user.id === t1.id, 'same number signs into the same account');
    const token = r.data.token;
    r = await call('GET', '/api/users/me', null, token);
    const me = r.data.user || r.data;
    ok(me.phone_verified === true && me.password_set === false, 'profile says verified phone, no password');

    console.log('profile');
    ok((await call('PUT', '/api/users/me', { name: 'Pat', phone_number: '2125559999' }, token)).status === 400, 'verified number cannot be edited away');
    r = await call('PUT', '/api/users/me', { name: 'Pat Q', phone_number: '212-555-0101' }, token); ok(r.status === 200, 'same number in another format saves');

    console.log('limits');
    await pool.query(`UPDATE phone_login_codes SET last_sent_at = NOW() - interval '2 minutes', sent_count = 5, sent_day = CURRENT_DATE WHERE phone = $1`, [P.a]);
    ok((await call('POST', '/api/auth/phone/start', { phone: P.a })).status === 429, '6th code in a day refused');
    await pool.query(`UPDATE phone_login_codes SET sent_count = 0 WHERE phone = $1`, [P.a]);
    await call('POST', '/api/auth/phone/start', { phone: P.a });
    for (let i = 0; i < 5; i++) await call('POST', '/api/auth/phone/verify', { phone: P.a, code: '000001' });
    ok((await call('POST', '/api/auth/phone/verify', { phone: P.a, code: lastCode() })).status === 400, 'right code refused after 5 wrong tries');

    console.log('who may not sign in by phone');
    const hash = await bcrypt.hash('Password123!', 10);
    await pool.query(`INSERT INTO users (name, email, password_hash, phone_number, email_verified, phone_verified, role) VALUES ('Mgr', 'phone_2125550102@habibi.internal', $1, $2, TRUE, TRUE, 'admin')`, [hash, P.b]);
    await call('POST', '/api/auth/phone/start', { phone: P.b });
    ok((await call('POST', '/api/auth/phone/verify', { phone: P.b, code: lastCode() })).status === 403, 'admin number refused');
    await pool.query(`INSERT INTO users (name, email, password_hash, phone_number, email_verified) VALUES ('Em', 'phonetest@example.com', $1, $2, TRUE)`, [hash, P.c]);
    await call('POST', '/api/auth/phone/start', { phone: P.c });
    r = await call('POST', '/api/auth/phone/verify', { phone: P.c, code: lastCode() });
    ok(r.status === 409 && !r.data.token && !r.data.signup_ticket, 'unconfirmed number on an email account: no sign-in, no duplicate');
    // Old phone sign-up that never entered its code is rescued.
    await pool.query(`INSERT INTO users (name, email, password_hash, phone_number, email_verified) VALUES ('Old', 'phone_2125550104@habibi.internal', $1, $2, FALSE)`, [hash, P.d]);
    await call('POST', '/api/auth/phone/start', { phone: P.d });
    r = await call('POST', '/api/auth/phone/verify', { phone: P.d, code: lastCode() });
    ok(r.status === 200 && r.data.token, 'unverified phone sign-up is verified and signed in');

    console.log('app password sign-in');
    r = await call('POST', '/api/auth/login', { email: 'phonetest@example.com', password: 'Password123!', app: true });
    const t2 = r.data.token && jwt.decode(r.data.token);
    ok(t2 && t2.exp - t2.iat === 30 * 86400, 'customer app login = 30 days');
    r = await call('POST', '/api/auth/login', { email: 'phonetest@example.com', password: 'Password123!' });
    const t3 = r.data.token && jwt.decode(r.data.token);
    ok(t3 && t3.exp - t3.iat === 86400, 'website login still 1 day');

    console.log('delete with a texted code');
    r = await call('DELETE', '/api/users/me', {}, token); ok(r.status === 400, 'delete needs confirmation');
    await allowResend(P.a);
    await call('POST', '/api/auth/phone/start', { phone: P.a });
    ok((await call('DELETE', '/api/users/me', { phone_code: lastCode() }, token)).status === 200, 'deleted with phone code');
    ok((await call('GET', '/api/users/me', null, token)).status === 401, 'deleted account token stops working');
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
