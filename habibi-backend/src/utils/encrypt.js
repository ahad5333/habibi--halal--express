const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be set and at least 32 chars in production.');
    }
    // Dev fallback — deterministic but insecure; only for local testing
    return Buffer.from('habibi-dev-key-0000000000000000');
  }
  // Use first 32 bytes of the key (allows longer keys for flexibility)
  return Buffer.from(raw.slice(0, 32), 'utf8');
}

function encrypt(plaintext) {
  const key  = getKey();
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext) {
  if (!ciphertext || !String(ciphertext).includes(':')) return ciphertext; // not encrypted
  try {
    const key   = getKey();
    const parts = String(ciphertext).split(':');
    if (parts.length !== 3) return ciphertext;
    const [ivHex, tagHex, dataHex] = parts;
    const iv       = Buffer.from(ivHex,  'hex');
    const tag      = Buffer.from(tagHex, 'hex');
    const data     = Buffer.from(dataHex,'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
  } catch (_) {
    return ciphertext; // return as-is if decryption fails (legacy plaintext)
  }
}

function encryptObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v ? encrypt(v) : v;
  }
  return out;
}

function decryptObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v ? decrypt(v) : v;
  }
  return out;
}

module.exports = { encrypt, decrypt, encryptObject, decryptObject };
