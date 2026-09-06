// HMAC salt used to sign/verify driver auth tokens (SMS links, X-Driver-Token
// header). Same crash-guard shape as CREDENTIAL_ENCRYPTION_KEY (utils/encrypt.js)
// — a hardcoded fallback here would mean anyone who's seen this source could
// compute a valid token for any driver_id, so production must never fall back to it.
function getDriverSecretSalt() {
  const raw = process.env.DRIVER_SECRET_SALT || '';
  if (raw.length >= 16) return raw;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DRIVER_SECRET_SALT must be set and at least 16 chars in production.');
  }
  // Dev fallback — deterministic but insecure; only for local testing
  return 'habibi-driver-default-dev-only';
}

module.exports = { getDriverSecretSalt };
