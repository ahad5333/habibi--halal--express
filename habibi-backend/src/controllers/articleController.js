const pool = require('../config/db');
const safeError = require('../utils/safeError');

const slugify = (str) =>
  str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// Public
const getPublicArticles = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, slug, subtitle, category, media_url, media_type,
              LEFT(body, 300) AS excerpt, created_at, sort_order
       FROM articles WHERE is_published = TRUE
       ORDER BY sort_order, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const getPublicArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM articles WHERE slug=$1 AND is_published=TRUE`, [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Article not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Admin
const getAllArticles = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, slug, subtitle, category, media_url, media_type, is_published, sort_order, created_at
       FROM articles ORDER BY sort_order, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const createArticle = async (req, res) => {
  try {
    const { title, subtitle, body, category, is_published, sort_order } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    let slug = slugify(title);
    // Ensure uniqueness
    const existing = await pool.query('SELECT id FROM articles WHERE slug=$1', [slug]);
    if (existing.rows.length) slug = `${slug}-${Date.now()}`;

    let media_url = req.body.media_url || null;
    let media_type = 'image';
    if (req.file) {
      media_url  = req.file.path?.startsWith('http') ? req.file.path : `/uploads/articles/${req.file.filename}`;
      media_type = req.file.mimetype?.startsWith('video') ? 'video' : 'image';
    }

    const { rows } = await pool.query(
      `INSERT INTO articles (title, slug, subtitle, body, category, media_url, media_type, is_published, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        title.trim(), slug,
        subtitle || null,
        body || null,
        category || 'General',
        media_url, media_type,
        is_published !== false && is_published !== 'false',
        parseInt(sort_order) || 0,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const current = await pool.query('SELECT * FROM articles WHERE id=$1', [id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Article not found' });
    const cur = current.rows[0];

    const { title, subtitle, body, category, is_published, sort_order } = req.body;

    let media_url  = req.body.media_url !== undefined ? req.body.media_url : cur.media_url;
    let media_type = cur.media_type;
    if (req.file) {
      media_url  = req.file.path?.startsWith('http') ? req.file.path : `/uploads/articles/${req.file.filename}`;
      media_type = req.file.mimetype?.startsWith('video') ? 'video' : 'image';
    }

    let slug = cur.slug;
    if (title && title.trim() !== cur.title) {
      slug = slugify(title);
      const ex = await pool.query('SELECT id FROM articles WHERE slug=$1 AND id!=$2', [slug, id]);
      if (ex.rows.length) slug = `${slug}-${Date.now()}`;
    }

    const { rows } = await pool.query(
      `UPDATE articles
       SET title=$1, slug=$2, subtitle=$3, body=$4, category=$5,
           media_url=$6, media_type=$7, is_published=$8, sort_order=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [
        title !== undefined ? title.trim() : cur.title,
        slug,
        subtitle !== undefined ? subtitle : cur.subtitle,
        body !== undefined ? body : cur.body,
        category !== undefined ? category : cur.category,
        media_url, media_type,
        is_published !== undefined ? (is_published !== false && is_published !== 'false') : cur.is_published,
        sort_order !== undefined ? parseInt(sort_order) : cur.sort_order,
        id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

const deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM articles WHERE id=$1', [id]);
    res.json({ message: 'Article deleted' });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { getPublicArticles, getPublicArticleBySlug, getAllArticles, createArticle, updateArticle, deleteArticle };
