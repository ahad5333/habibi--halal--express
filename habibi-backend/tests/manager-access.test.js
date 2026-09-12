// Run with: node tests/manager-access.test.js  (uses the LOCAL database, and
// deletes the throwaway accounts it creates.)
// Runs real requests through the real adminRoutes router with `protect` stubbed
// out (no token is minted). Everything after protect -- refreshPanelRole,
// adminOrManager, merchantOrManager, managerScope -- is the production code.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const ROOT = require('path').join(__dirname, '..');

// Stub protect: stands in for "a valid token for CURRENT.id was presented".
const CURRENT = { id: null, tokenRole: null };
const authPath = require.resolve(ROOT + '/src/middleware/authMiddleware');
const passthrough = (req, res, next) => { req.user = { id: CURRENT.id, role: CURRENT.tokenRole }; next(); };
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true, exports:
    Object.assign(passthrough, { protect: passthrough, admin: passthrough, optionalAuth: passthrough, revokeToken: () => {} }),
};

const express = require('express');
const pool = require(ROOT + '/src/config/db');
const adminRoutes = require(ROOT + '/src/routes/adminRoutes');

const crashes = [];
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use((req, res) => res.status(599).json({ reached: true }));
// A middleware that throws would otherwise surface as a generic 500 and read as
// "allowed". Capture it as 598 so a crash can never be mistaken for a pass.
app.use((err, req, res, next) => { crashes.push(`${req.method} ${req.path} -> ${err.message}`); res.status(598).json({}); });

const server = app.listen(0);
const port = server.address().port;

const call = async (method, p) => {
  const r = await fetch(`http://127.0.0.1:${port}/api/admin${p}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: ['POST', 'PATCH', 'PUT'].includes(method) ? '{}' : undefined,
  });
  return r.status;
};

// Allowed = the authorization chain let it through. A handler may still fail on
// data (500); that is not an authorization decision. 598 means a crash.
const allowed = (s) => s !== 401 && s !== 403 && s !== 598;

let fails = 0;
const check = (label, cond) => { if (!cond) { console.log('  FAIL:', label); fails++; } };

(async () => {
  const mk = async (role) => (await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1,$2,'x',$3,TRUE) RETURNING id`,
    ['TEMP ' + role, `temp_${role}_${Date.now()}@test.invalid`, role])).rows[0].id;

  const adminId   = await mk('admin');
  const managerId = await mk('manager');

  try {
    // ── 1. Admin still reaches everything it used to
    CURRENT.id = adminId; CURRENT.tokenRole = 'admin';
    for (const [m, p] of [['GET', '/stats'], ['GET', '/payments'], ['GET', '/customers'],
                          ['GET', '/settings'], ['GET', '/panel-users'], ['PATCH', '/orders/1/payment-status']]) {
      check(`admin allowed ${m} ${p}`, allowed(await call(m, p)));
    }

    // ── 2. Manager reaches its four areas
    CURRENT.id = managerId; CURRENT.tokenRole = 'manager';
    for (const [m, p] of [['GET', '/stats'], ['GET', '/orders'], ['GET', '/orders/unified'],
                          ['GET', '/menus'], ['GET', '/inventory'], ['GET', '/waste'],
                          ['GET', '/business-hours'], ['GET', '/locations'],
                          ['GET', '/staff'], ['GET', '/schedule'], ['PATCH', '/orders/1/status']]) {
      check(`manager allowed ${m} ${p}`, allowed(await call(m, p)));
    }

    // ── 3. Manager is blocked from money, customers, settings and privilege management
    for (const [m, p] of [['GET', '/payments'], ['GET', '/refunds'], ['GET', '/reports/revenue'],
                          ['GET', '/analytics/revenue'], ['GET', '/customers'], ['GET', '/coupons'],
                          ['GET', '/settings'], ['GET', '/audit-log'], ['GET', '/panel-users'],
                          ['POST', '/panel-users'], ['PATCH', '/panel-users/1'],
                          ['PATCH', '/orders/1/payment-status'], ['POST', '/locations'],
                          ['GET', '/card-processors/accounts'], ['GET', '/authnet/accounts']]) {
      check(`manager BLOCKED ${m} ${p}`, (await call(m, p)) === 403);
    }

    // ── 4. A stale token cannot outlive a demotion
    CURRENT.id = adminId; CURRENT.tokenRole = 'admin';          // token still says admin
    await pool.query(`UPDATE users SET role='manager' WHERE id=$1`, [adminId]);
    check('demotion applies on the next request', (await call('GET', '/payments')) === 403);
    await pool.query(`UPDATE users SET role='admin' WHERE id=$1`, [adminId]);
    check('restoring the role restores access', allowed(await call('GET', '/payments')));

    // ── 5. Switching an account off cuts it off immediately
    await pool.query(`UPDATE users SET is_active=FALSE WHERE id=$1`, [adminId]);
    check('deactivated account is refused', (await call('GET', '/stats')) === 403);
    await pool.query(`UPDATE users SET is_active=TRUE WHERE id=$1`, [adminId]);

    // ── 6. A deleted account cannot keep using its token
    const ghost = await mk('admin');
    CURRENT.id = ghost; CURRENT.tokenRole = 'admin';
    await pool.query('DELETE FROM users WHERE id=$1', [ghost]);
    check('deleted account is refused', (await call('GET', '/stats')) === 401);

    if (crashes.length) {
      console.log('\nMIDDLEWARE CRASHES:');
      crashes.forEach(c => console.log('  ', c));
      fails += crashes.length;
    }
    console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll authorization checks passed');
  } finally {
    await pool.query(`DELETE FROM users WHERE email LIKE 'temp_%@test.invalid'`);
    const { rows } = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE email LIKE 'temp_%@test.invalid'`);
    console.log('cleanup — temp rows left:', rows[0].n);
    server.close(); await pool.end();
  }
  process.exit(fails ? 1 : 0);
})();
