const jwt = require("jsonwebtoken");

// ── Token revocation: L1 (memory) + L2 (DB) ───────────────────────────────
// Memory cache gives sub-ms lookup on hot path.
// DB provides durability across restarts — a revoked token stays revoked
// even if the process crashes and restarts before its natural expiry.
const _revokedJTIs = new Map();

// Evict entries whose natural expiry has passed — keeps memory bounded
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of _revokedJTIs) {
    if (exp < now) _revokedJTIs.delete(jti);
  }
}, 60 * 60 * 1000).unref();

// Write to memory + DB (DB write is async — fire-and-forget is intentional:
// the token is revoked in memory immediately; DB is a durability backstop)
const revokeToken = (jti, exp) => {
  if (!jti) return;
  _revokedJTIs.set(jti, exp);
  const pool = require('../config/db');
  pool.query(
    'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [jti, new Date(exp * 1000).toISOString()]
  ).catch(e => console.error('[Auth] Failed to persist revoked JTI:', e.message));
};

function extractToken(req) {
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.jti) {
      // L1 check (fast)
      if (_revokedJTIs.has(decoded.jti)) {
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }
      // L2 check (DB) — catches revocations that happened before this process started
      try {
        const pool = require('../config/db');
        const { rowCount } = await pool.query(
          'SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW()',
          [decoded.jti]
        );
        if (rowCount > 0) {
          _revokedJTIs.set(decoded.jti, decoded.exp); // warm L1 cache
          return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
      } catch (_) { /* DB unavailable — fail open for availability */ }
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
module.exports.protect = protect;
module.exports.admin = admin;
module.exports.optionalAuth = optionalAuth;
module.exports.revokeToken = revokeToken;