const jwt = require("jsonwebtoken");

// ── In-memory token revocation list ────────────────────────────────────────
// Stores { jti -> exp (unix seconds) } for tokens invalidated via logout.
// Survives within a process; clears on restart (acceptable: tokens now
// expire in 24 h, so the maximum residual window after a restart is 24 h).
const _revokedJTIs = new Map();

// Cleanup: remove entries for tokens that have already expired naturally
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of _revokedJTIs) {
    if (exp < now) _revokedJTIs.delete(jti);
  }
}, 60 * 60 * 1000).unref(); // .unref() so this never keeps the process alive

const revokeToken = (jti, exp) => { if (jti) _revokedJTIs.set(jti, exp); };

function extractToken(req) {
  // Prefer httpOnly cookie (not accessible to XSS)
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  // Fall back to Authorization header for API clients and mobile
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

const protect = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Reject explicitly revoked tokens (logout)
    if (decoded.jti && _revokedJTIs.has(decoded.jti)) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

// Sets req.user if a valid token is present, but never rejects unauthenticated requests.
const optionalAuth = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.jti || !_revokedJTIs.has(decoded.jti)) {
        req.user = decoded;
      }
    }
  } catch (_) { /* invalid or expired token — proceed as guest */ }
  next();
};

module.exports = protect;
module.exports.admin = admin;
module.exports.optionalAuth = optionalAuth;
module.exports.revokeToken = revokeToken;