// ── Who can sign in to the CPanel ───────────────────────────────────────────
// Admin-only. Managers are default-denied by managerScope, and the routes also
// mount the admin middleware explicitly, so privilege management never depends
// on a single check.
//
// There is deliberately no "create a login" here. Someone is promoted from an
// account they already registered and verified themselves, so no password is
// ever set on another person's behalf and no invite flow can be replayed.
const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { logAudit } = require('./auditController');
const { PANEL_ROLES, MANAGER_ROLE } = require('../middleware/managerMiddleware');

// 'superadmin' is intentionally not assignable over the API — it exists in the
// role set but can only be granted directly in the database.
const ASSIGNABLE = new Set(['admin', MANAGER_ROLE]);
const REVOKED_ROLE = 'customer';

const listPanelUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, created_at
         FROM users
        WHERE role = ANY($1)
        ORDER BY (role = 'manager'), LOWER(COALESCE(name, email))`,
      [[...PANEL_ROLES]]
    );
    res.json({ users: rows, assignable: [...ASSIGNABLE] });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// How many admins could still sign in if this user were changed — used to stop
// the last one being demoted or switched off.
const otherActiveAdmins = async (excludeId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM users
      WHERE role IN ('admin','superadmin') AND is_active IS NOT FALSE AND id <> $1`,
    [excludeId]
  );
  return rows[0].n;
};

// Promote an existing account to admin or manager, by email.
const grantPanelAccess = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role  = String(req.body?.role  || '').trim();
    if (!email) return res.status(400).json({ message: 'Enter the email address of the person you want to give access to.' });
    if (!ASSIGNABLE.has(role)) return res.status(400).json({ message: 'Role must be admin or manager.' });

    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE LOWER(email) = $1',
      [email]
    );
    if (!rows.length) {
      return res.status(404).json({
        message: 'No account with that email. Ask them to register on the website first, then give them access here.',
      });
    }
    const user = rows[0];
    if (user.id === req.user?.id) return res.status(400).json({ message: 'You cannot change your own access.' });
    if (PANEL_ROLES.has(user.role)) {
      return res.status(409).json({ message: `${user.name || user.email} already has ${user.role} access. Change it from the list instead.` });
    }

    await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, user.id]);
    logAudit(pool, req.user?.id, req.user?.name, 'grant_panel_access', 'user', String(user.id),
      { email: user.email, from: user.role, to: role }, req.ip);

    res.json({ success: true, message: `${user.name || user.email} can now sign in as ${role}.` });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Change someone's role, or switch their access off.
const updatePanelUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid user.' });
    if (id === req.user?.id) return res.status(400).json({ message: 'You cannot change your own access.' });

    const { rows } = await pool.query('SELECT id, name, email, role, is_active FROM users WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });
    const user = rows[0];
    if (!PANEL_ROLES.has(user.role)) return res.status(400).json({ message: 'That account does not have panel access.' });

    const wantsRole   = req.body?.role !== undefined;
    const wantsActive = req.body?.is_active !== undefined;
    if (!wantsRole && !wantsActive) return res.status(400).json({ message: 'Nothing to change.' });

    const nextRole   = wantsRole   ? String(req.body.role) : user.role;
    const nextActive = wantsActive ? !!req.body.is_active  : user.is_active !== false;

    // 'customer' is how panel access is taken away entirely.
    if (wantsRole && !ASSIGNABLE.has(nextRole) && nextRole !== REVOKED_ROLE) {
      return res.status(400).json({ message: 'Role must be admin, manager, or removed.' });
    }

    // Never let the last person who can administer the panel lose the ability.
    const losesAdmin = ['admin', 'superadmin'].includes(user.role) &&
                       (!['admin', 'superadmin'].includes(nextRole) || !nextActive);
    if (losesAdmin && (await otherActiveAdmins(user.id)) === 0) {
      return res.status(409).json({
        message: 'This is the only admin left. Give someone else admin access before changing this one.',
      });
    }

    await pool.query(
      'UPDATE users SET role = $1, is_active = $2, updated_at = NOW() WHERE id = $3',
      [nextRole, nextActive, id]
    );
    logAudit(pool, req.user?.id, req.user?.name, 'update_panel_access', 'user', String(id),
      { email: user.email, from: { role: user.role, is_active: user.is_active !== false },
        to: { role: nextRole, is_active: nextActive } }, req.ip);

    // refreshPanelRole re-reads the role on every panel request, so this takes
    // effect on their very next click — no waiting for their token to expire.
    const label = nextRole === REVOKED_ROLE ? 'no longer has panel access'
                : !nextActive               ? `is switched off (${nextRole})`
                :                             `is now ${nextRole}`;
    res.json({ success: true, message: `${user.name || user.email} ${label}.` });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { listPanelUsers, grantPanelAccess, updatePanelUser };
