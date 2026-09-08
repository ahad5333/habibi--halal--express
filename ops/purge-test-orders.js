#!/usr/bin/env node
/**
 * Purge test orders before client handover.
 *
 * Every order currently in the database is a test order placed while building
 * and verifying the site (confirmed by the team, 2026-09-08). This removes them
 * and everything that hangs off them, so the client receives a clean system.
 *
 * WHY THIS ISN'T JUST "DELETE FROM guest_orders":
 * Only ONE table (inventory_order_log) actually has a foreign key to
 * guest_orders. The other ~20 tables reference orders by a plain order_number
 * or order_id column with no constraint at all. A bare DELETE would therefore
 * SUCCEED and quietly leave orphaned order_items, delivery assignments,
 * reviews, chat messages, status history and courier records pointing at
 * orders that no longer exist -- which is worse than not deleting, because it
 * looks clean while the admin panel still surfaces the debris.
 *
 * SAFETY:
 *   - Dry run by default. Prints exactly what WOULD be deleted, changes nothing.
 *   - Requires --execute to actually delete, and runs inside one transaction,
 *     so a failure part-way leaves the database untouched.
 *   - Take a database backup first regardless (ops/habibi-db-backup.sh).
 *
 * USAGE (on the server, from habibi-backend/):
 *   node -r dotenv/config ../ops/purge-test-orders.js              # dry run
 *   node -r dotenv/config ../ops/purge-test-orders.js --execute    # delete
 *   node -r dotenv/config ../ops/purge-test-orders.js --execute --reset-sequences
 */

const path = require('path');
const pool = require(path.join(__dirname, '..', 'habibi-backend', 'src', 'config', 'db'));

const EXECUTE         = process.argv.includes('--execute');
const RESET_SEQUENCES = process.argv.includes('--reset-sequences');

// Children first, parent last. Each entry says how it points at an order.
// `by: 'number'` -> matches guest_orders.order_number
// `by: 'id'`     -> matches guest_orders.id
const DEPENDENTS = [
  { table: 'order_items',            col: 'order_id',     by: 'id'     },
  { table: 'order_status_history',   col: 'order_id',     by: 'id'     },
  { table: 'order_status_log',       col: 'order_number', by: 'number' },
  { table: 'delivery_assignments',   col: 'order_number', by: 'number' },
  { table: 'doordash_deliveries',    col: 'order_number', by: 'number' },
  { table: 'roadie_deliveries',      col: 'order_number', by: 'number' },
  { table: 'uber_deliveries',        col: 'order_number', by: 'number' },
  { table: 'inventory_order_log',    col: 'order_number', by: 'number' },
  { table: 'gift_card_transactions', col: 'order_number', by: 'number' },
  { table: 'subscription_charges',   col: 'order_number', by: 'number' },
  { table: 'chat_messages',          col: 'order_number', by: 'number' },
  { table: 'reviews',                col: 'order_number', by: 'number' },
  { table: 'quick_payments',         col: 'order_number', by: 'number' },
  { table: 'pending_checkouts',      col: 'order_number', by: 'number' },
];

// Deliberately NOT touched. Two different reasons:
//   - business_orders / partner_orders / orders: separate order streams
//     (wholesale, marketplace, legacy), not website orders, and nobody has
//     confirmed they're test data.
//   - urgent_requests: its order_id is a varchar holding free text, not a
//     reference -- observed values include NULL, '' and a full tracking URL.
//     There's no reliable way to match it to an order, and these are the
//     medical / food-safety SOS alerts, so they get reviewed by hand rather
//     than matched by a guess.
const REPORT_ONLY = ['business_orders', 'partner_orders', 'orders', 'urgent_requests'];

// Quote-safe: every table/column name here is a literal from the arrays above,
// never user input.
const sqlIn = (by) =>
  by === 'id'
    ? '(SELECT id FROM guest_orders)'
    : '(SELECT order_number FROM guest_orders)';

async function tableExists(client, table) {
  const r = await client.query('SELECT to_regclass($1) AS x', ['public.' + table]);
  return !!r.rows[0].x;
}

(async () => {
  const client = await pool.connect();
  try {
    const orders = await client.query('SELECT COUNT(*)::int n FROM guest_orders');
    const orderCount = orders.rows[0].n;

    console.log('='.repeat(60));
    console.log(EXECUTE ? 'PURGE TEST ORDERS  (EXECUTING)' : 'PURGE TEST ORDERS  (DRY RUN - nothing will change)');
    console.log('='.repeat(60));
    console.log('\nguest_orders to delete: ' + orderCount);

    if (orderCount === 0) {
      console.log('\nNothing to do.');
      return;
    }

    console.log('\nDependent rows that would go with them:');
    let totalChildren = 0;
    const plan = [];
    for (const d of DEPENDENTS) {
      if (!(await tableExists(client, d.table))) {
        console.log('  ' + d.table.padEnd(24) + '  (table does not exist, skipped)');
        continue;
      }
      const q = `SELECT COUNT(*)::int n FROM ${d.table} WHERE ${d.col} IN ${sqlIn(d.by)}`;
      const n = (await client.query(q)).rows[0].n;
      totalChildren += n;
      plan.push(d);
      console.log('  ' + d.table.padEnd(24) + String(n).padStart(6) + '  (via ' + d.col + ')');
    }
    console.log('  ' + '-'.repeat(32));
    console.log('  ' + 'dependent rows total'.padEnd(24) + String(totalChildren).padStart(6));

    console.log('\nNOT touched (separate order streams - confirm before purging):');
    for (const t of REPORT_ONLY) {
      if (!(await tableExists(client, t))) { console.log('  ' + t.padEnd(24) + '  (no such table)'); continue; }
      const n = (await client.query(`SELECT COUNT(*)::int n FROM ${t}`)).rows[0].n;
      console.log('  ' + t.padEnd(24) + String(n).padStart(6) + ' rows');
    }

    if (!EXECUTE) {
      console.log('\nDry run only. Re-run with --execute to delete.');
      console.log('Take a backup first: bash ops/habibi-db-backup.sh');
      return;
    }

    console.log('\nDeleting inside a transaction...');
    await client.query('BEGIN');
    for (const d of plan) {
      const r = await client.query(`DELETE FROM ${d.table} WHERE ${d.col} IN ${sqlIn(d.by)}`);
      console.log('  ' + d.table.padEnd(24) + ' deleted ' + r.rowCount);
    }
    const go = await client.query('DELETE FROM guest_orders');
    console.log('  ' + 'guest_orders'.padEnd(24) + ' deleted ' + go.rowCount);

    if (RESET_SEQUENCES) {
      // So the client's first real order doesn't start at an odd id.
      for (const t of ['guest_orders', 'order_items', 'delivery_assignments']) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1,'id'), 1, false)`, [t]
        ).catch(e => console.log('  (sequence reset skipped for ' + t + ': ' + e.message + ')'));
      }
      console.log('  sequences reset');
    }

    await client.query('COMMIT');
    console.log('\nDone. Committed.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED, rolled back — database unchanged:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
