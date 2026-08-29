const pool = require('../config/db');

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

module.exports = { deactivateAllCardProcessors };
