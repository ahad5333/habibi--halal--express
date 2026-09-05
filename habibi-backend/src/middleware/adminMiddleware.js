const ALLOWED_ROLES = new Set(['admin', 'superadmin']);

const adminMiddleware = (req, res, next) => {
  if (!req.user || !ALLOWED_ROLES.has(req.user.role)) {
    return res.status(403).json({ message: 'Admin access only.' });
  }
  next();
};

module.exports = adminMiddleware;
// Exported so other code that needs to know "is this a privileged role" (e.g.
// authController.js's MFA gate) checks the exact same set instead of
// duplicating/drifting from it.
module.exports.ALLOWED_ROLES = ALLOWED_ROLES;