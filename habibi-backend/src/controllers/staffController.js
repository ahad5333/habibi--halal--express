const safeError = require('../utils/safeError');
const pool = require('../config/db');
const crypto = require('crypto');
const { sendSMS } = require('../services/smsService');

function driverToken(driver_id) {
  const salt = process.env.DRIVER_SECRET_SALT || 'habibi-driver-default';
  return crypto.createHmac('sha256', salt).update(String(driver_id)).digest('hex');
}

const VALID_ROLES = ['kitchen', 'delivery', 'manager', 'cashier', 'server'];

exports.getStaff = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM staff_members ORDER BY is_active DESC, name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { name, email, phone, role, shift_start, shift_end, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      `INSERT INTO staff_members (name, email, phone, role, shift_start, shift_end, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, email || null, phone || null, role || 'kitchen',
       shift_start || null, shift_end || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, shift_start, shift_end, notes, is_active } = req.body;
    const result = await pool.query(
      `UPDATE staff_members
       SET name=$1, email=$2, phone=$3, role=$4,
           shift_start=$5, shift_end=$6, notes=$7, is_active=$8,
           updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, email || null, phone || null, role, shift_start || null,
       shift_end || null, notes || null, is_active !== false, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Staff not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    await pool.query('DELETE FROM staff_members WHERE id=$1', [req.params.id]);
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Bulk-import staff from a CSV (name, phone, email, role). Delivery rows
// with a phone are texted the same self-service PIN-setup link used by the
// single-add and driver-bulk-import flows; every other role is a roster
// entry only — no login exists for kitchen/manager/cashier/server today. ──
exports.bulkImportStaff = async (req, res) => {
  const { staff } = req.body;
  if (!Array.isArray(staff) || staff.length === 0) {
    return res.status(400).json({ error: 'No staff provided.' });
  }
  if (staff.length > 200) {
    return res.status(400).json({ error: 'Max 200 staff per import.' });
  }

  const created = [];
  const skipped = [];

  for (const row of staff) {
    const name  = String(row.name  || '').trim().slice(0, 100);
    const phone = String(row.phone || '').trim().slice(0, 30);
    const email = String(row.email || '').trim().slice(0, 100);
    let role    = String(row.role  || 'kitchen').trim().toLowerCase();
    if (!VALID_ROLES.includes(role)) role = 'kitchen';

    if (!name) { skipped.push({ name, phone, role, reason: 'Missing name' }); continue; }

    try {
      if (phone) {
        const existing = await pool.query(`SELECT id FROM staff_members WHERE phone=$1`, [phone]);
        if (existing.rows.length) { skipped.push({ name, phone, role, reason: 'Phone already registered' }); continue; }
      }

      const result = await pool.query(
        `INSERT INTO staff_members (name, phone, email, role, is_active) VALUES ($1,$2,$3,$4,TRUE) RETURNING id, name, phone, role`,
        [name, phone || null, email || null, role]
      );
      const member = result.rows[0];
      created.push(member);

      if (role === 'delivery' && phone) {
        const token = driverToken(member.id);
        const base  = process.env.FRONTEND_URL || 'https://habibihe.com';
        const url   = `${base}/driver/set-pin?id=${member.id}&token=${token}`;
        sendSMS(phone, `Hi ${name}! Set up your Habibi driver PIN to log in anytime: ${url}`)
          .catch(err => console.error('[BulkImport] SMS failed for', phone, err.message));
      }
    } catch (err) {
      skipped.push({ name, phone, role, reason: err.message });
    }
  }

  res.json({ created_count: created.length, skipped_count: skipped.length, created, skipped });
};

// ── Bulk-remove staff ────────────────────────────────────────────────
exports.bulkDeleteStaff = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No staff IDs provided.' });
  }
  try {
    const result = await pool.query('DELETE FROM staff_members WHERE id = ANY($1) RETURNING id', [ids]);
    res.json({ deleted_count: result.rowCount });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// ── Bulk activate/deactivate staff ──────────────────────────────────
exports.bulkSetStaffStatus = async (req, res) => {
  const { ids, is_active } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No staff IDs provided.' });
  }
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be true or false.' });
  }
  try {
    const result = await pool.query(
      'UPDATE staff_members SET is_active=$1, updated_at=NOW() WHERE id = ANY($2) RETURNING id',
      [is_active, ids]
    );
    res.json({ updated_count: result.rowCount });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
