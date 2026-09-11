const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { logAudit } = require('./auditController');

// ── Waste tracking ────────────────────────────────────────────────────────────
// Kitchen staff (PIN screen) and admins (CPanel) log food that's thrown away.
// Stock moves exactly the way an order moves it: a wasted dish lowers every
// inventory item linked to that dish (inventory_items.menu_item_id), a wasted
// ingredient lowers that item. Never below zero -- waste must never block, and
// what was actually removed is stored so an undo restores exactly that.

const REASONS = {
  expired:         'Expired',
  spoiled:         'Spoiled',
  dropped:         'Dropped / spilled',
  burnt:           'Burnt / overcooked',
  wrong_order:     'Wrong order made',
  customer_return: 'Customer returned',
  overproduction:  'Made too much',
  other:           'Other',
};
const STAFF_UNDO_MINUTES = 15;
const RANGES = [7, 30, 90];

// Dishes, ingredients, stores and reasons for the log form.
async function wasteOptions() {
  const [dishes, ingredients, locations] = await Promise.all([
    pool.query(`SELECT id, name, category, cost_price FROM menus WHERE is_active = TRUE ORDER BY name`),
    pool.query(`SELECT id, name, category, unit, cost_per_unit FROM inventory_items ORDER BY name`),
    pool.query(`SELECT id, title FROM locations WHERE is_active = TRUE ORDER BY id`),
  ]);
  return {
    dishes: dishes.rows.map(d => ({ id: d.id, name: d.name, category: d.category, has_cost: d.cost_price !== null })),
    ingredients: ingredients.rows.map(i => ({ id: i.id, name: i.name, category: i.category, unit: i.unit || 'unit', has_cost: parseFloat(i.cost_per_unit) > 0 })),
    locations: locations.rows,
    reasons: Object.entries(REASONS).map(([value, label]) => ({ value, label })),
  };
}

// Shared by the staff and admin routes. `who` = { type, id, name }.
async function recordWaste(body, who) {
  const { menu_item_id, inventory_item_id, reason } = body || {};
  const quantity = parseFloat(body?.quantity);
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : null;
  const locationId = body?.location_id ? parseInt(body.location_id, 10) : null;

  const fail = (msg) => { const e = new Error(msg); e.statusCode = 400; throw e; };
  if (!!menu_item_id === !!inventory_item_id) fail('Choose one dish or one ingredient.');
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) fail('Enter a quantity between 0 and 1000.');
  if (!REASONS[reason]) fail('Choose a reason.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (locationId) {
      const loc = await client.query('SELECT 1 FROM locations WHERE id = $1', [locationId]);
      if (!loc.rows.length) fail('Unknown location.');
    }

    let item; let kind; let unit; let unitCost; let stockRows;
    if (menu_item_id) {
      const r = await client.query('SELECT id, name, cost_price FROM menus WHERE id = $1', [parseInt(menu_item_id, 10)]);
      if (!r.rows.length) fail('That dish no longer exists.');
      item = r.rows[0]; kind = 'dish'; unit = 'portion';
      unitCost = item.cost_price !== null ? parseFloat(item.cost_price) : null;
      stockRows = await client.query(
        'SELECT id, current_stock FROM inventory_items WHERE menu_item_id = $1 FOR UPDATE', [item.id]
      );
    } else {
      const r = await client.query(
        'SELECT id, name, unit, cost_per_unit, current_stock FROM inventory_items WHERE id = $1 FOR UPDATE',
        [parseInt(inventory_item_id, 10)]
      );
      if (!r.rows.length) fail('That ingredient no longer exists.');
      item = r.rows[0]; kind = 'ingredient'; unit = item.unit || 'unit';
      unitCost = parseFloat(item.cost_per_unit) > 0 ? parseFloat(item.cost_per_unit) : null;
      stockRows = { rows: [{ id: item.id, current_stock: item.current_stock }] };
    }

    // Lower stock (never below zero) and remember what was actually removed.
    const adjustments = [];
    for (const row of stockRows.rows) {
      const removed = Math.min(quantity, Math.max(parseFloat(row.current_stock) || 0, 0));
      if (removed <= 0) continue;
      await client.query(
        'UPDATE inventory_items SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2',
        [removed, row.id]
      );
      await client.query(
        `INSERT INTO inventory_order_log (item_id, quantity_change, reason) VALUES ($1, $2, 'waste')`,
        [row.id, -removed]
      );
      adjustments.push({ item_id: row.id, qty: removed });
    }

    const totalCost = unitCost !== null ? Math.round(unitCost * quantity * 100) / 100 : null;
    const ins = await client.query(
      `INSERT INTO waste_log
         (location_id, menu_item_id, inventory_item_id, item_name, item_kind, quantity, unit, reason, note,
          unit_cost, total_cost, stock_adjustments, logged_by_type, logged_by_id, logged_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [locationId, kind === 'dish' ? item.id : null, kind === 'ingredient' ? item.id : null, item.name, kind,
       quantity, unit, reason, note || null, unitCost, totalCost, JSON.stringify(adjustments),
       who.type, who.id || null, who.name || null]
    );
    await client.query('COMMIT');
    return ins.rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Deletes an entry and puts back exactly the stock it removed.
async function removeWaste(id, guard) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT * FROM waste_log WHERE id = $1 FOR UPDATE', [id]);
    const entry = r.rows[0];
    if (!entry) { const e = new Error('Entry not found.'); e.statusCode = 404; throw e; }
    guard(entry);
    for (const a of entry.stock_adjustments || []) {
      const up = await client.query(
        'UPDATE inventory_items SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2',
        [a.qty, a.item_id]
      );
      if (up.rowCount) {
        await client.query(
          `INSERT INTO inventory_order_log (item_id, quantity_change, reason) VALUES ($1, $2, 'waste_undo')`,
          [a.item_id, a.qty]
        );
      }
    }
    await client.query('DELETE FROM waste_log WHERE id = $1', [id]);
    await client.query('COMMIT');
    return entry;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const sendError = (res, err) => res.status(err.statusCode || 500).json(err.statusCode ? { message: err.message } : safeError(err));

// ── Staff (PIN screen) ────────────────────────────────────────────────────────
exports.staffWasteOptions = async (req, res) => {
  try { res.json(await wasteOptions()); } catch (err) { sendError(res, err); }
};

exports.staffLogWaste = async (req, res) => {
  try {
    const entry = await recordWaste(req.body, { type: 'staff', id: req.staffId, name: req.staffName });
    res.status(201).json(entry);
  } catch (err) { sendError(res, err); }
};

// This person's entries from the last 24 hours; recent ones can be undone.
exports.staffMyWaste = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, item_name, item_kind, quantity, unit, reason, total_cost, created_at,
              created_at > NOW() - make_interval(mins => $2) AS can_undo
         FROM waste_log
        WHERE logged_by_type = 'staff' AND logged_by_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 20`,
      [req.staffId, STAFF_UNDO_MINUTES]
    );
    res.json(r.rows);
  } catch (err) { sendError(res, err); }
};

// Staff can undo their own mistakes for a few minutes; after that it's a
// manager's call in CPanel.
exports.staffUndoWaste = async (req, res) => {
  try {
    await removeWaste(parseInt(req.params.id, 10), (entry) => {
      const mine = entry.logged_by_type === 'staff' && entry.logged_by_id === req.staffId;
      const fresh = Date.now() - new Date(entry.created_at).getTime() < STAFF_UNDO_MINUTES * 60000;
      if (!mine || !fresh) {
        const e = new Error(`Entries can only be undone by the person who logged them, within ${STAFF_UNDO_MINUTES} minutes.`);
        e.statusCode = 403; throw e;
      }
    });
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
};

// ── Admin (CPanel) ────────────────────────────────────────────────────────────
exports.adminWasteOptions = exports.staffWasteOptions;

exports.adminLogWaste = async (req, res) => {
  try {
    const entry = await recordWaste(req.body, { type: 'admin', id: req.user?.id, name: req.user?.name || 'Admin' });
    logAudit(pool, req.user?.id, req.user?.name, 'log_waste', 'waste', String(entry.id),
      { item: entry.item_name, quantity: entry.quantity, reason: entry.reason }, req.ip);
    res.status(201).json(entry);
  } catch (err) { sendError(res, err); }
};

exports.adminDeleteWaste = async (req, res) => {
  try {
    const entry = await removeWaste(parseInt(req.params.id, 10), () => {});
    logAudit(pool, req.user?.id, req.user?.name, 'delete_waste', 'waste', String(entry.id),
      { item: entry.item_name, quantity: entry.quantity, reason: entry.reason, logged_by: entry.logged_by_name }, req.ip);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
};

// GET /api/admin/waste?days=30&location_id=2
exports.getWasteReport = async (req, res) => {
  try {
    const days = RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const loc = req.query.location_id ? parseInt(req.query.location_id, 10) : null;
    const where = `created_at > NOW() - make_interval(days => $1::int) AND ($2::int IS NULL OR location_id = $2)`;
    const params = [days, loc];

    const [summary, byReason, byItem, byDay, entries] = await Promise.all([
      pool.query(`
        SELECT count(*)::int AS entries,
               COALESCE(sum(total_cost), 0)::float AS total_cost,
               count(*) FILTER (WHERE total_cost IS NULL)::int AS without_cost
          FROM waste_log WHERE ${where}`, params),
      pool.query(`
        SELECT reason, count(*)::int AS entries, COALESCE(sum(total_cost), 0)::float AS cost
          FROM waste_log WHERE ${where} GROUP BY reason ORDER BY cost DESC, entries DESC`, params),
      pool.query(`
        SELECT item_name, item_kind, unit, sum(quantity)::float AS quantity, count(*)::int AS entries,
               COALESCE(sum(total_cost), 0)::float AS cost, bool_or(total_cost IS NULL) AS missing_cost
          FROM waste_log WHERE ${where}
         GROUP BY item_name, item_kind, unit ORDER BY cost DESC, quantity DESC LIMIT 15`, params),
      pool.query(`
        SELECT to_char(created_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day,
               count(*)::int AS entries, COALESCE(sum(total_cost), 0)::float AS cost
          FROM waste_log WHERE ${where} GROUP BY day ORDER BY day`, params),
      pool.query(`
        SELECT w.id, w.created_at, w.item_name, w.item_kind, w.quantity, w.unit, w.reason, w.note,
               w.total_cost, w.logged_by_type, w.logged_by_name, l.title AS location
          FROM waste_log w LEFT JOIN locations l ON l.id = w.location_id
         WHERE w.created_at > NOW() - make_interval(days => $1::int) AND ($2::int IS NULL OR w.location_id = $2)
         ORDER BY w.created_at DESC LIMIT 100`, params),
    ]);

    res.json({
      days,
      reasons: REASONS,
      summary: summary.rows[0],
      by_reason: byReason.rows,
      by_item: byItem.rows,
      by_day: byDay.rows,
      entries: entries.rows,
    });
  } catch (err) { sendError(res, err); }
};
