// ── Panel manager role ───────────────────────────────────────────────────────
// A 'manager' is a users.role — a real CPanel login (email + password + the same
// email MFA an admin gets). It is NOT the same thing as staff_members.role =
// 'manager', which is a PIN login for the kitchen queue and never touches this
// table or this middleware.
//
// The rule here is default-deny. Managers are deliberately NOT added to
// adminMiddleware's ALLOWED_ROLES, so nothing in the panel opens up to them by
// accident. They only reach a route if it is explicitly mounted with
// adminOrManager / merchantOrManager, and, under /api/admin, only if its path
// also appears in MANAGER_ALLOWED below. An endpoint added later is closed to
// managers until someone opens it on purpose.
const { ALLOWED_ROLES: ADMIN_ROLES }    = require('./adminMiddleware');
const { ALLOWED_ROLES: MERCHANT_ROLES } = require('./merchantMiddleware');

const pool = require('../config/db');

const MANAGER_ROLE = 'manager';

// A JWT carries whatever role the account had when it was issued, and an admin
// token lasts 24h — so demoting someone, or switching their account off, would
// not have taken effect until their token expired. Re-read both from the
// database on each panel request instead, the way staffMiddleware already does
// for staff sessions, so a change applies on the very next request.
// Every token this can see is signed from a users row (authController is the
// only place that signs one), so the lookup always has a subject.
const refreshPanelRole = async (req, res, next) => {
  if (!req.user?.id) return next();
  try {
    const { rows } = await pool.query('SELECT role, is_active FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(401).json({ message: 'Session expired. Please log in again.' });
    if (rows[0].is_active === false) {
      return res.status(403).json({ message: 'This account has been switched off.' });
    }
    req.user.role = rows[0].role;
  } catch (_) {
    // Database unreachable: fall back to the role in the token rather than
    // locking the whole panel out. Same trade-off authMiddleware makes for its
    // revocation check, and nothing else in the panel works without the DB anyway.
  }
  next();
};

// Who may sign in to the CPanel at all — and therefore who must pass email MFA.
// Wider than ADMIN_ROLES on purpose: a manager gets through the door, then the
// scope below decides which rooms. authController reads this for its MFA gate;
// if a new panel role is ever added it must be added here too, or that login
// would skip MFA.
const PANEL_ROLES = new Set([...ADMIN_ROLES, MANAGER_ROLE]);

const FORBIDDEN = { message: 'Your account does not have access to this part of the panel.' };

// Mount on routes a manager is allowed to use. Admins behave exactly as before.
const adminOrManager = (req, res, next) => {
  if (req.user && (ADMIN_ROLES.has(req.user.role) || req.user.role === MANAGER_ROLE)) return next();
  return res.status(403).json(FORBIDDEN);
};

// Same idea for the few routes that already served the merchant app.
const merchantOrManager = (req, res, next) => {
  if (req.user && (MERCHANT_ROLES.has(req.user.role) || req.user.role === MANAGER_ROLE)) return next();
  return res.status(403).json(FORBIDDEN);
};

// Paths a manager may use under /api/admin. Matched against req.path as seen
// inside that router (so "/orders", not "/api/admin/orders"), with the query
// string already stripped. '*' means any method.
//
// The deliberate omissions matter as much as the entries:
//   /orders/:id/payment-status  — marks money paid or refunded
//   /payments, /refunds, /reports, /analytics, /cash-log
//   /customers                  — customer records and addresses
//   /coupons, /gift-cards, /loyalty, /referrals
//   /settings, /audit-log, /integrations, /platform-credentials
//   write access to /locations  — branch address, phone and tablet credentials
const MANAGER_ALLOWED = [
  // Dashboard. getDashboardStats and getToday both strip the takings for managers.
  ['GET',   /^\/stats$/],
  ['GET',   /^\/today$/],

  // Orders: see them, and move them through the kitchen and delivery flow.
  ['GET',   /^\/orders$/],
  ['GET',   /^\/orders\/unified$/],

  // Menu
  ['*',     /^\/menus(\/.*)?$/],
  ['*',     /^\/byo-ingredients(\/.*)?$/],
  ['*',     /^\/global-addons(\/.*)?$/],

  // Stock and waste
  ['*',     /^\/inventory(\/.*)?$/],
  ['GET',   /^\/waitlist\/counts$/],
  ['*',     /^\/waste(\/.*)?$/],

  // Opening hours
  ['GET',   /^\/business-hours$/],
  ['POST',  /^\/business-hours$/],

  // Branches, read-only — the menu and hours pages need the branch dropdown.
  // Creating or editing a branch stays admin-only.
  ['GET',   /^\/locations$/],

  // Staff records and the rota
  ['*',     /^\/staff(\/.*)?$/],
  ['*',     /^\/schedule(\/.*)?$/],
];

const managerMayReach = (method, path) =>
  MANAGER_ALLOWED.some(([m, re]) => (m === '*' || m === method) && re.test(path));

// Default-deny scope for everything mounted under /api/admin. Admins and any
// other role pass straight through; only managers are filtered.
const managerScope = (req, res, next) => {
  if (req.user?.role !== MANAGER_ROLE) return next();
  if (managerMayReach(req.method, req.path)) return next();
  return res.status(403).json(FORBIDDEN);
};

module.exports = {
  MANAGER_ROLE,
  refreshPanelRole,
  PANEL_ROLES,
  adminOrManager,
  merchantOrManager,
  managerScope,
  managerMayReach,
};
