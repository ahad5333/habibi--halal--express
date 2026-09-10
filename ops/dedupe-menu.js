#!/usr/bin/env node
/**
 * Merge dishes that appear twice in the SAME menu section.
 *
 * WHY: a later bulk re-import (ids #11xx-12xx, added 2026-06-26..07-04) put
 * 27 Breakfast dishes and 3 Sandwich dishes on the live menu a second time,
 * so customers see them side by side. Neither copy is simply "right": the
 * newer batch carries the brand spelling ("berger"), but some newer copies
 * LOST their add-ons (e.g. Eggs & Hot Dog & Salad Plate has no "Extra Egg").
 * Keeping either batch wholesale would lose something.
 *
 * WHAT IT DOES, per duplicate pair (same name + same category, both visible):
 *   - keeps ONE listing: the one with the most history and live references
 *     (orders, favourites, subscriptions...), so sales history stays attached;
 *   - fills that listing with the best of both: the newest description, and
 *     options/add-ons from whichever copy actually has them;
 *   - HIDES the other copy (is_active = FALSE). Nothing is deleted;
 *   - repoints live references (favourites, carts, subscriptions, waitlist,
 *     location availability, inventory, add-on/choice groups) to the keeper.
 *
 * WHAT IT DOESN'T TOUCH:
 *   - the same dish listed in DIFFERENT sections (e.g. Beef Burger under both
 *     Sandwich and Bergers) -- that can be deliberate, and isn't a duplicate
 *     customers see side by side;
 *   - any pair with a genuine conflict (different prices, or both copies
 *     having different add-ons) -- those are listed for a human to decide;
 *   - order history, which records what was actually bought.
 *
 * SAFETY: dry run by default. --apply runs in ONE transaction and first saves
 * every row it will change to menu_dedupe_backup, so the whole run can be
 * reversed with --undo <run_id>.
 *
 * USAGE (on the server, from habibi-backend/):
 *   node -r dotenv/config ../ops/dedupe-menu.js               # dry run
 *   node -r dotenv/config ../ops/dedupe-menu.js --apply
 *   node -r dotenv/config ../ops/dedupe-menu.js --undo <run_id>
 */

const path = require('path');
const pool = require(path.join(__dirname, '..', 'habibi-backend', 'src', 'config', 'db'));

const APPLY = process.argv.includes('--apply');
// Rehearsal: apply, verify, undo, verify the undo restored everything -- all
// inside one transaction that is then ROLLED BACK. Proves both code paths
// against real data without persisting anything.
const TEST = process.argv.includes('--test');
const UNDO_ID = (() => { const i = process.argv.indexOf('--undo'); return i > -1 ? process.argv[i + 1] : null; })();

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const hasOpts = (v) => Array.isArray(v) ? v.length > 0 : !!(v && typeof v === 'object' && Object.keys(v).length);
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Live tables that point at a dish. [table, column]. Order history is
// deliberately absent: it records what was bought and must not be rewritten.
const REF_TABLES = [
  ['user_favorites', 'menu_item_id'],
  ['cart_items', 'menu_item_id'],
  ['cart_items', 'menu_id'],
  ['group_order_items', 'menu_item_id'],
  ['item_waitlist', 'menu_item_id'],
  ['menu_item_locations', 'menu_item_id'],
  ['menu_location_availability', 'menu_id'],
  ['inventory_items', 'menu_item_id'],
  ['addon_groups', 'menu_item_id'],
  ['choice_groups', 'menu_item_id'],
];

async function tableHas(client, table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column]);
  return r.rows.length > 0;
}

// Columns that, together with the dish id, must be unique -- so a repoint
// that would create a duplicate (e.g. a user who favourited BOTH copies) is
// resolved by dropping the redundant row instead of violating the constraint.
async function uniquePartners(client, table, column) {
  const r = await client.query(`
    SELECT array_agg(a.attname ORDER BY a.attnum) cols
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
     WHERE t.relname = $1 AND (i.indisunique OR i.indisprimary)
     GROUP BY i.indexrelid`, [table]);
  return r.rows.map(x => x.cols).filter(cols => cols.includes(column) && cols.length > 1)
    .map(cols => cols.filter(c => c !== column));
}

async function loadRefs(client, ids) {
  const counts = {}; // id -> { label: n }
  const add = (id, k, n) => { (counts[id] ??= {})[k] = ((counts[id] ?? {})[k] || 0) + n; };

  for (const [t, c] of REF_TABLES) {
    if (!(await tableHas(client, t, c))) continue;
    const r = await client.query(`SELECT ${c} AS id, COUNT(*)::int n FROM ${t} WHERE ${c} = ANY($1) GROUP BY 1`, [ids]);
    r.rows.forEach(x => add(x.id, `${t}`, x.n));
  }
  const subs = await client.query(`SELECT id, items FROM subscriptions WHERE items IS NOT NULL`).catch(() => ({ rows: [] }));
  for (const s of subs.rows) {
    for (const it of Array.isArray(s.items) ? s.items : []) {
      const mid = Number(it.menu_item_id ?? it.menuItemId ?? it.id);
      if (ids.includes(mid)) add(mid, 'subscriptions', 1);
    }
  }
  const sold = await client.query(`
    SELECT COALESCE(item->>'menu_item_id', item->>'menuItemId', item->>'id') k, COUNT(*)::int n
      FROM guest_orders, jsonb_array_elements(CASE WHEN jsonb_typeof(items)='array' THEN items ELSE '[]'::jsonb END) item
     GROUP BY 1`);
  sold.rows.forEach(x => /^\d+$/.test(x.k) && ids.includes(Number(x.k)) && add(Number(x.k), 'order_history', x.n));
  return counts;
}

async function plan(client) {
  const { rows } = await client.query(
    `SELECT id, name, category, price, description, image_url, choices, addons, is_active, is_available
       FROM menus WHERE is_active IS NOT FALSE ORDER BY id`);

  const groups = new Map();
  for (const r of rows) {
    const k = norm(r.name) + '||' + (r.category || '');
    (groups.get(k) || groups.set(k, []).get(k)).push(r);
  }
  const dupGroups = [...groups.values()].filter(g => g.length > 1);
  const allIds = dupGroups.flat().map(r => r.id);
  const refs = await loadRefs(client, allIds);
  const refTotal = (id) => Object.values(refs[id] || {}).reduce((a, n) => a + n, 0);

  // add-on / choice groups living in their own tables count as "options" too
  const optGroups = {};
  for (const t of ['addon_groups', 'choice_groups']) {
    if (!(await tableHas(client, t, 'menu_item_id'))) continue;
    const r = await client.query(`SELECT menu_item_id id, COUNT(*)::int n FROM ${t} WHERE menu_item_id = ANY($1) GROUP BY 1`, [allIds]);
    r.rows.forEach(x => optGroups[x.id] = (optGroups[x.id] || 0) + x.n);
  }
  const richness = (r) => (hasOpts(r.choices) ? 1 : 0) + (hasOpts(r.addons) ? 1 : 0) + (optGroups[r.id] || 0);

  const merges = [];
  const conflicts = [];
  for (const g of dupGroups) {
    // Keeper: most history/references, then richest options, then newest.
    const ranked = [...g].sort((a, b) =>
      refTotal(b.id) - refTotal(a.id) || richness(b) - richness(a) || b.id - a.id);
    const keep = ranked[0];
    const drop = ranked.slice(1);

    const issues = [];
    if (g.some(r => Number(r.price) !== Number(keep.price))) {
      issues.push(`prices differ (${g.map(r => `#${r.id} $${Number(r.price).toFixed(2)}`).join(' vs ')})`);
    }
    const withOpts = g.filter(r => hasOpts(r.choices) || hasOpts(r.addons));
    const distinctOpts = new Set(withOpts.map(r => JSON.stringify([r.choices, r.addons])));
    if (distinctOpts.size > 1) issues.push('both copies have DIFFERENT add-ons/choices');
    const withGroups = g.filter(r => optGroups[r.id]);
    if (withGroups.length > 1) issues.push('add-on groups attached to more than one copy');

    if (issues.length) { conflicts.push({ name: keep.name.trim(), category: keep.category, rows: g, issues }); continue; }

    // Best-of-both fields onto the keeper.
    const newest = [...g].sort((a, b) => b.id - a.id)[0];
    const set = {};
    if (norm(newest.description) && norm(newest.description) !== norm(keep.description)) set.description = newest.description;
    // Only when the keeper genuinely has none. If both copies already carry
    // identical options (the common case), copying is a no-op and would just
    // be a misleading line in the plan.
    const keeperHasOpts = hasOpts(keep.choices) || hasOpts(keep.addons);
    const optSource = withOpts.find(r => r.id !== keep.id);
    if (!keeperHasOpts && optSource) { set.choices = optSource.choices; set.addons = optSource.addons; }
    if (!keep.image_url) { const img = g.find(r => r.image_url); if (img) set.image_url = img.image_url; }
    const moveGroupsFrom = withGroups.length === 1 && withGroups[0].id !== keep.id ? withGroups[0].id : null;

    merges.push({ name: keep.name.trim(), category: keep.category, keep, drop, set, moveGroupsFrom,
                  refs: Object.fromEntries(g.map(r => [r.id, refs[r.id] || {}])) });
  }
  return { merges, conflicts, refs };
}

async function apply(client, merges) {
  const runId = `dedupe-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await client.query(`
    CREATE TABLE IF NOT EXISTS menu_dedupe_backup (
      id SERIAL PRIMARY KEY, run_id TEXT NOT NULL, tbl TEXT NOT NULL,
      row_key JSONB NOT NULL, before JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`);

  const backup = async (tbl, key, before) =>
    client.query(`INSERT INTO menu_dedupe_backup (run_id, tbl, row_key, before) VALUES ($1,$2,$3,$4)`,
      [runId, tbl, JSON.stringify(key), before === undefined ? null : JSON.stringify(before)]);

  for (const m of merges) {
    const dropIds = m.drop.map(d => d.id);

    // 1. menus: snapshot, fill keeper, hide the rest
    for (const r of [m.keep, ...m.drop]) {
      const full = await client.query('SELECT * FROM menus WHERE id = $1', [r.id]);
      await backup('menus', { id: r.id }, full.rows[0]);
    }
    const cols = Object.keys(m.set);
    if (cols.length) {
      const vals = cols.map(c => (c === 'choices' || c === 'addons') ? JSON.stringify(m.set[c]) : m.set[c]);
      await client.query(
        `UPDATE menus SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`,
        [...vals, m.keep.id]);
    }
    await client.query(`UPDATE menus SET is_active = FALSE WHERE id = ANY($1)`, [dropIds]);

    // 2. live references -> keeper
    for (const [t, c] of REF_TABLES) {
      if (!(await tableHas(client, t, c))) continue;
      if ((t === 'addon_groups' || t === 'choice_groups') && m.moveGroupsFrom === null) continue;
      const rowsRes = await client.query(`SELECT * FROM ${t} WHERE ${c} = ANY($1)`, [dropIds]);
      if (!rowsRes.rows.length) continue;
      const partners = await uniquePartners(client, t, c);
      for (const row of rowsRes.rows) {
        await backup(t, { [c]: row[c], _row: row.id ?? null }, row);
        // Would this repoint collide with a row the keeper already has?
        let collides = false;
        for (const others of partners) {
          const where = others.map((o, i) => `${o} = $${i + 2}`).join(' AND ');
          const hit = await client.query(`SELECT 1 FROM ${t} WHERE ${c} = $1 AND ${where} LIMIT 1`,
            [m.keep.id, ...others.map(o => row[o])]);
          if (hit.rows.length) { collides = true; break; }
        }
        const idCol = row.id !== undefined ? 'id' : null;
        if (collides && idCol) await client.query(`DELETE FROM ${t} WHERE id = $1`, [row.id]);
        else if (idCol) await client.query(`UPDATE ${t} SET ${c} = $1 WHERE id = $2`, [m.keep.id, row.id]);
        else await client.query(`UPDATE ${t} SET ${c} = $1 WHERE ${c} = $2`, [m.keep.id, row[c]]);
      }
    }

    // 3. subscriptions: ids live inside a JSON array
    const subs = await client.query(`SELECT id, items FROM subscriptions WHERE items IS NOT NULL`).catch(() => ({ rows: [] }));
    for (const s of subs.rows) {
      if (!Array.isArray(s.items)) continue;
      let changed = false;
      const items = s.items.map(it => {
        const mid = Number(it.menu_item_id ?? it.menuItemId ?? it.id);
        if (!dropIds.includes(mid)) return it;
        changed = true;
        const n = { ...it };
        for (const k of ['menu_item_id', 'menuItemId', 'id']) if (k in n) n[k] = m.keep.id;
        return n;
      });
      if (changed) {
        await backup('subscriptions', { id: s.id }, { items: s.items });
        await client.query(`UPDATE subscriptions SET items = $1 WHERE id = $2`, [JSON.stringify(items), s.id]);
      }
    }
  }
  return runId;
}

async function undo(client, runId) {
  const rows = (await client.query(
    `SELECT tbl, row_key, before FROM menu_dedupe_backup WHERE run_id = $1 ORDER BY id DESC`, [runId])).rows;
  if (!rows.length) throw new Error(`no backup rows for ${runId}`);
  for (const r of rows) {
    const b = r.before;
    if (r.tbl === 'menus') {
      // A NULL column must come back as SQL NULL, not as the JSON value null
      // that JSON.stringify(null) would write -- both read as null in JS, so a
      // snapshot comparison can't tell them apart, but a restore should be exact.
      const j = (v) => (v === null || v === undefined ? null : JSON.stringify(v));
      await client.query(
        `UPDATE menus SET description=$1, choices=$2, addons=$3, image_url=$4, is_active=$5 WHERE id=$6`,
        [b.description, j(b.choices), j(b.addons), b.image_url, b.is_active, b.id]);
    } else if (r.tbl === 'subscriptions') {
      await client.query(`UPDATE subscriptions SET items = $1 WHERE id = $2`, [JSON.stringify(b.items), r.row_key.id]);
    } else if (b && b.id !== undefined) {
      const cols = Object.keys(b);
      const exists = await client.query(`SELECT 1 FROM ${r.tbl} WHERE id = $1`, [b.id]);
      if (exists.rows.length) {
        await client.query(`UPDATE ${r.tbl} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`,
          [...cols.map(c => b[c]), b.id]);
      } else {
        await client.query(`INSERT INTO ${r.tbl} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
          cols.map(c => b[c]));
      }
    }
  }
  return rows.length;
}

// Everything the merge can touch, as one comparable snapshot.
async function snapshot(client, ids) {
  const out = {};
  out.menus = (await client.query(
    `SELECT id, is_active, description, choices, addons, image_url FROM menus WHERE id = ANY($1) ORDER BY id`, [ids])).rows;
  for (const [t, c] of REF_TABLES) {
    if (!(await tableHas(client, t, c))) continue;
    out[`${t}.${c}`] = (await client.query(`SELECT * FROM ${t} ORDER BY 1`)).rows;
  }
  out.subscriptions = (await client.query(`SELECT id, items FROM subscriptions ORDER BY id`).catch(() => ({ rows: [] }))).rows;
  return JSON.stringify(out);
}

// Customer-visible menu: name+category pairs shown more than once.
async function visibleDuplicates(client) {
  const r = await client.query(`
    SELECT lower(regexp_replace(trim(name), '[[:space:]]+', ' ', 'g')) k, category, COUNT(*)::int n
      FROM menus WHERE is_available = TRUE AND is_active = TRUE
     GROUP BY 1, 2 HAVING COUNT(*) > 1`);
  return r.rows;
}

async function rehearse(client, merges) {
  const ids = [...new Set(merges.flatMap(m => [m.keep.id, ...m.drop.map(d => d.id)]))];
  await client.query('BEGIN');
  try {
    const before = await snapshot(client, ids);
    const dupBefore = await visibleDuplicates(client);
    const activeBefore = (await client.query(`SELECT COUNT(*)::int n FROM menus WHERE is_active AND is_available`)).rows[0].n;

    const runId = await apply(client, merges);
    const dupAfter = await visibleDuplicates(client);
    const activeAfter = (await client.query(`SELECT COUNT(*)::int n FROM menus WHERE is_active AND is_available`)).rows[0].n;

    // Every add-on that existed on ANY copy must still be on the kept copy.
    let addonsLost = 0;
    for (const m of merges) {
      const k = (await client.query(`SELECT choices, addons FROM menus WHERE id = $1`, [m.keep.id])).rows[0];
      const anyHad = [m.keep, ...m.drop].some(r => hasOpts(r.choices) || hasOpts(r.addons));
      if (anyHad && !hasOpts(k.choices) && !hasOpts(k.addons)) addonsLost++;
    }

    const restored = await undo(client, runId);
    const after = await snapshot(client, ids);

    console.log('\n--- REHEARSAL (inside a transaction, rolled back) ---');
    console.log(`  side-by-side duplicates on the customer menu: ${dupBefore.length} -> ${dupAfter.length}` +
      (dupAfter.length === 1 ? ' (the one left is Better Sandwich, held for a decision)' : ''));
    dupAfter.forEach(d => console.log(`      still duplicated: ${d.k} [${d.category}] x${d.n}`));
    console.log(`  dishes visible to customers: ${activeBefore} -> ${activeAfter} (${activeBefore - activeAfter} hidden)`);
    console.log(`  kept copies that lost all add-ons/choices: ${addonsLost}` + (addonsLost ? '  *** PROBLEM ***' : ' (none)'));
    console.log(`  undo restored ${restored} rows; state identical to before: ${before === after ? 'YES' : '*** NO ***'}`);
  } finally {
    await client.query('ROLLBACK');
    console.log('  rolled back — nothing was changed.');
  }
}

(async () => {
  const client = await pool.connect();
  try {
    if (UNDO_ID) {
      await client.query('BEGIN');
      const n = await undo(client, UNDO_ID);
      await client.query('COMMIT');
      console.log(`Undid ${UNDO_ID}: restored ${n} rows.`);
      return;
    }

    const { merges, conflicts } = await plan(client);
    const hidden = merges.reduce((a, m) => a + m.drop.length, 0);
    console.log('='.repeat(72));
    console.log(APPLY ? 'MENU DEDUPE  (APPLYING)' : 'MENU DEDUPE  (DRY RUN — nothing will change)');
    console.log('='.repeat(72));
    console.log(`\nSafe to merge: ${merges.length} dishes -> ${hidden} duplicate listing(s) hidden from customers`);
    for (const m of merges) {
      const moved = Object.entries(m.refs).filter(([id]) => Number(id) !== m.keep.id)
        .flatMap(([, r]) => Object.entries(r).filter(([k]) => k !== 'order_history').map(([k, n]) => `${k}:${n}`));
      console.log(`\n  ${m.name}  [${m.category}]`);
      console.log(`    keep #${m.keep.id}   hide ${m.drop.map(d => '#' + d.id).join(', ')}`);
      if (m.set.description) console.log(`    description <- newest copy: ${JSON.stringify(String(m.set.description).slice(0, 90))}`);
      if (m.set.addons || m.set.choices) console.log(`    add-ons/choices <- copied from the copy that has them`);
      if (m.moveGroupsFrom) console.log(`    add-on groups moved from #${m.moveGroupsFrom}`);
      if (m.set.image_url) console.log(`    photo <- filled from the other copy`);
      if (moved.length) console.log(`    live references moved to #${m.keep.id}: ${moved.join(', ')}`);
    }
    console.log(`\nNeeds a human decision (left exactly as they are): ${conflicts.length}`);
    for (const c of conflicts) {
      console.log(`  ${c.name}  [${c.category}]  ${c.rows.map(r => '#' + r.id).join(', ')}`);
      c.issues.forEach(i => console.log(`    - ${i}`));
    }

    if (TEST) {
      await rehearse(client, merges);
      return;
    }
    if (!APPLY) {
      console.log('\nDry run only. Re-run with --apply to make these changes (reversible with --undo).');
      return;
    }
    await client.query('BEGIN');
    const runId = await apply(client, merges);
    await client.query('COMMIT');
    console.log(`\nApplied. Run id: ${runId}`);
    console.log(`To reverse everything: node -r dotenv/config ../ops/dedupe-menu.js --undo ${runId}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED, rolled back — nothing changed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
