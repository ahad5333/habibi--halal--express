const ALLOWED_ROLES = new Set(['admin', 'superadmin', 'merchant']);

const adminMiddleware = (req, res, next) => {
  if (!req.user || !ALLOWED_ROLES.has(req.user.role)) {
    return res.status(403).json({ message: 'Admin access only.' });
  }
  next();
};

module.exports = adminMiddleware;