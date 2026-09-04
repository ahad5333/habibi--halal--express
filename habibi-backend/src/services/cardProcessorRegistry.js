const pool = require('../config/db');
const { decrypt, decryptObject } = require('../utils/encrypt');

// Card processor credentials live in two separate tables — authorize_net_accounts
// (its own dedicated table, untouched) and card_processor_accounts (Square/Clover,
// shared table). Each has its own is_active flag, and nothing stops both tables
// from having an active row at once unless every "set active" action clears both
// first. Call this inside the same transaction as the UPDATE ... SET is_active =
// TRUE that follows it, so "exactly one active card processor, globally" is a
// real invariant rather than a UI convention.
async function deactivateAllCardProcessors(client) {
  const runner = client || pool;
  await runner.query(`UPDATE authorize_net_accounts SET is_active = FALSE`);
  await runner.query(`UPDATE card_processor_accounts SET is_active = FALSE`);
}

// ── Helper — fetch the currently active card processor, of any kind ──────
// Checks authorize_net_accounts and card_processor_accounts for whichever
// single row is active across both tables (deactivateAllCardProcessors
// guarantees there's at most one). Returns decrypted credentials — callers
// get the real values, same contract as authNetController.getActiveAccount().
//
// Lives in this services-layer registry (not a controller) specifically so
// controllers on both sides of it -- cardProcessorController.js and
// giftCardController.js -- can import it without requiring each other and
// risking a circular require (cardProcessorController already requires
// orderController for finalizePendingCheckout; giftCardController requiring
// cardProcessorController would have closed that into a cycle).
async function getActiveCardProcessor() {
  const authNet = await pool.query(`SELECT * FROM authorize_net_accounts WHERE is_active = TRUE LIMIT 1`);
  if (authNet.rows[0]) {
    const account = authNet.rows[0];
    if (account.transaction_key) account.transaction_key = decrypt(account.transaction_key);
    return { provider: 'authorize_net', account };
  }

  const other = await pool.query(`SELECT * FROM card_processor_accounts WHERE is_active = TRUE LIMIT 1`);
  if (other.rows[0]) {
    const row = other.rows[0];
    return { provider: row.provider, account: { ...row, credentials: decryptObject(row.credentials || {}) } };
  }

  return null;
}

// ── Helper — fetch credentials for a SPECIFIC provider, active or not ────
// Saved cards must keep working against whichever processor originally
// saved them even after the admin switches the active one -- this is the
// "any account for this provider" lookup, as opposed to
// getActiveCardProcessor()'s "whichever is active" lookup.
async function getCardProcessorAccountByProvider(provider) {
  if (provider === 'authorize_net') {
    const res = await pool.query(`SELECT * FROM authorize_net_accounts ORDER BY is_active DESC, created_at DESC LIMIT 1`);
    const account = res.rows[0];
    if (account?.transaction_key) account.transaction_key = decrypt(account.transaction_key);
    return account || null;
  }
  const res = await pool.query(
    `SELECT * FROM card_processor_accounts WHERE provider = $1 ORDER BY is_active DESC, created_at DESC LIMIT 1`,
    [provider]
  );
  const row = res.rows[0];
  return row ? { ...row, credentials: decryptObject(row.credentials || {}) } : null;
}

module.exports = { deactivateAllCardProcessors, getActiveCardProcessor, getCardProcessorAccountByProvider };
