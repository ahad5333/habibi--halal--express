// Home banners -- the poster carousel at the top of the app's Home screen,
// managed from CPanel (Marketing > Home Banners) so a sale's posters can go
// up and come down without an app update.
//
// Each banner: a poster image, an optional tap action, and an optional
// start / end time. The public list only returns banners that are switched on
// AND inside their time window, so a sale's posters appear and disappear on
// their own. Times are entered and shown in New York time (the business's
// clock); stored as timestamptz.
//
// Tap actions (link_type -> link_value):
//   none     -> nothing
//   offer    -> a coupon code; the app saves it for checkout (the server still
//               validates it there, so a stale code just fails politely)
//   category -> a menu category name, e.g. "Breakfast"
//   item     -> a menu item id
//   url      -> an https:// link
const pool = require('../config/db');
const safeError = require('../utils/safeError');

const LINK_TYPES = new Set(['none', 'offer', 'category', 'item', 'url']);
const MAX_PUBLIC = 6; // carousels lose people past ~5 posters
const TZ = 'America/New_York';

// "2026-11-27T09:00" from a datetime-local input, read as New York time.
// Empty -> null (no limit). Anything else is rejected.
function parseNyLocal(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(String(v))) throw new Error('Dates must look like 2026-11-27T09:00');
  return String(v);
}

function cleanLink(type, value) {
  const t = LINK_TYPES.has(type) ? type : 'none';
  const v = String(value ?? '').trim();
  if (t === 'none') return { t, v: null };
  if (!v) throw new Error('Choose what the banner opens');
  if (v.length > 255) throw new Error('Link is too long');
  if (t === 'url' && !/^https:\/\/[^\s]+$/i.test(v)) throw new Error('Links must start with https://');
  if (t === 'item' && !/^\d+$/.test(v)) throw new Error('Pick a menu item');
  if (t === 'offer' && !/^[A-Za-z0-9_-]{2,40}$/.test(v)) throw new Error('Offer codes are letters and numbers only');
  return { t, v: t === 'offer' ? v.toUpperCase() : v };
}

const imageFrom = f => (f ? (f.path?.startsWith('http') ? f.path : `/uploads/menus/${f.filename}`) : null);

const ADMIN_COLS = `id, title, image_url, link_type, link_value, sort_order, is_active, created_at,
  to_char(starts_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS starts_at,
  to_char(ends_at   AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS ends_at,
  (is_active AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW())) AS live_now`;

// GET /api/banners -- public: what the app shows right now.
exports.getPublicBanners = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, image_url, link_type, link_value FROM home_banners
        WHERE is_active AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW())
        ORDER BY sort_order, id LIMIT ${MAX_PUBLIC}`);
    res.set('Cache-Control', 'public, max-age=60');
    res.json(rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// GET /api/admin/banners
exports.getAdminBanners = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${ADMIN_COLS} FROM home_banners ORDER BY sort_order, id`);
    res.json(rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// POST /api/admin/banners (multipart: image + fields)
exports.createBanner = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Give the banner a name (it is also read out by screen readers)' });
    if (title.length > 120) return res.status(400).json({ message: 'Name is too long (120 characters max)' });
    const image_url = imageFrom(req.file);
    if (!image_url) return res.status(400).json({ message: 'Upload a poster image' });
    let link, starts, ends;
    try { link = cleanLink(req.body.link_type, req.body.link_value); starts = parseNyLocal(req.body.starts_at) ?? null; ends = parseNyLocal(req.body.ends_at) ?? null; }
    catch (e) { return res.status(400).json({ message: e.message }); }
    if (starts && ends && ends <= starts) return res.status(400).json({ message: 'The end time must be after the start time' });
    const { rows } = await pool.query(
      `INSERT INTO home_banners (title, image_url, link_type, link_value, starts_at, ends_at, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5::timestamp AT TIME ZONE '${TZ}', $6::timestamp AT TIME ZONE '${TZ}', $7, $8)
       RETURNING id`,
      [title, image_url, link.t, link.v, starts, ends, parseInt(req.body.sort_order, 10) || 0, req.body.is_active !== 'false']);
    const { rows: out } = await pool.query(`SELECT ${ADMIN_COLS} FROM home_banners WHERE id = $1`, [rows[0].id]);
    res.status(201).json(out[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// PATCH /api/admin/banners/:id (multipart; absent fields stay as they are)
exports.updateBanner = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows: cur } = await pool.query(`SELECT ${ADMIN_COLS} FROM home_banners WHERE id = $1`, [id]);
    if (!cur.length) return res.status(404).json({ message: 'Banner not found' });
    const c = cur[0], b = req.body;
    const title = b.title !== undefined ? String(b.title).trim() : c.title;
    if (!title) return res.status(400).json({ message: 'Give the banner a name' });
    if (title.length > 120) return res.status(400).json({ message: 'Name is too long (120 characters max)' });
    let link, starts, ends;
    try {
      link = b.link_type !== undefined ? cleanLink(b.link_type, b.link_value) : { t: c.link_type, v: c.link_value };
      starts = b.starts_at !== undefined ? parseNyLocal(b.starts_at) : c.starts_at;
      ends = b.ends_at !== undefined ? parseNyLocal(b.ends_at) : c.ends_at;
    } catch (e) { return res.status(400).json({ message: e.message }); }
    if (starts && ends && ends <= starts) return res.status(400).json({ message: 'The end time must be after the start time' });
    await pool.query(
      `UPDATE home_banners SET title = $1, image_url = $2, link_type = $3, link_value = $4,
         starts_at = $5::timestamp AT TIME ZONE '${TZ}', ends_at = $6::timestamp AT TIME ZONE '${TZ}',
         sort_order = $7, is_active = $8, updated_at = NOW()
       WHERE id = $9`,
      [title, imageFrom(req.file) || c.image_url, link.t, link.v, starts || null, ends || null,
        b.sort_order !== undefined ? parseInt(b.sort_order, 10) || 0 : c.sort_order,
        b.is_active !== undefined ? b.is_active !== 'false' && b.is_active !== false : c.is_active, id]);
    const { rows: out } = await pool.query(`SELECT ${ADMIN_COLS} FROM home_banners WHERE id = $1`, [id]);
    res.json(out[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// DELETE /api/admin/banners/:id
exports.deleteBanner = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM home_banners WHERE id = $1', [parseInt(req.params.id, 10)]);
    if (!rowCount) return res.status(404).json({ message: 'Banner not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
