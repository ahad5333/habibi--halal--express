const ALLOWED_ROLES = new Set(['admin', 'superadmin', 'merchant']);

const merchantMiddleware = (req, res, next) => {
  if (!req.user || !ALLOWED_ROLES.has(req.user.role)) {
    return res.status(403).json({ message: 'Access denied.' });
  }
  next();
};

module.exports = merchantMiddleware;
