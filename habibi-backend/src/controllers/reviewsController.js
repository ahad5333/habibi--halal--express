const pool = require('../config/db');

// Public: GET /api/reviews
const getReviews = async (req, res) => {
  try {
    const { limit = 20, rating, sort = 'newest', featured } = req.query;

    const params = [];
    const conditions = ['is_approved = TRUE'];

    if (rating) {
      params.push(parseInt(rating, 10));
      conditions.push(`rating = $${params.length}`);
    }
    if (featured === 'true') {
      conditions.push('is_featured = TRUE');
    }

    const sortMap = { rating: 'rating DESC, created_at DESC', newest: 'created_at DESC' };
    const orderBy = sortMap[sort] || 'created_at DESC';
    params.push(Math.min(parseInt(limit, 10) || 20, 100));

    const [rows, stats] = await Promise.all([
      pool.query(
        `SELECT id, customer_name, rating, comment, reply, is_featured, created_at
         FROM reviews
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderBy}
         LIMIT $${params.length}`,
        params
      ),
      pool.query(
        `SELECT
           COUNT(*)::int                                        AS total,
           COALESCE(ROUND(AVG(rating), 1), 0)::numeric         AS avg_rating,
           COUNT(*) FILTER (WHERE rating = 5)::int             AS five_star,
           COUNT(*) FILTER (WHERE rating = 4)::int             AS four_star,
           COUNT(*) FILTER (WHERE rating = 3)::int             AS three_star,
           COUNT(*) FILTER (WHERE rating = 2)::int             AS two_star,
           COUNT(*) FILTER (WHERE rating = 1)::int             AS one_star
         FROM reviews WHERE is_approved = TRUE`
      ),
    ]);

    res.json({ reviews: rows.rows, stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// POST /api/reviews  (optionalAuth — logged-in users get identity from JWT)
const submitReview = async (req, res) => {
  try {
    let { order_number, customer_name, customer_email, rating, comment } = req.body;
    const user_id = req.user?.id || null;

    // If authenticated, override name/email with verified data from DB
    if (user_id) {
      const userRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [user_id]);
      if (userRes.rows[0]) {
        customer_name  = userRes.rows[0].name  || customer_name;
        customer_email = userRes.rows[0].email || customer_email;
      }
    }

    if (!customer_name || !rating) {
      return res.status(400).json({ error: 'Name and rating are required.' });
    }
    const r = parseInt(rating, 10);
    if (r < 1 || r > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    // Prevent duplicate reviews for the same order
    if (order_number) {
      const dup = await pool.query(
        `SELECT id FROM reviews WHERE order_number = $1 AND (user_id = $2 OR customer_email = $3) LIMIT 1`,
        [order_number, user_id, customer_email?.trim() || null]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'You have already reviewed this order.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO reviews (order_number, user_id, customer_name, customer_email, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [order_number || null, user_id, customer_name.trim(),
       customer_email?.trim() || null, r, comment?.trim() || null]
    );
    res.status(201).json({
      success: true,
      id: result.rows[0].id,
      message: 'Thank you! Your review will appear after moderation.',
    });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Admin: GET /api/admin/reviews
const getAdminReviews = async (req, res) => {
  try {
    const { status } = req.query;
    let where = '';
    if (status === 'pending')  where = 'WHERE is_approved = FALSE';
    if (status === 'approved') where = 'WHERE is_approved = TRUE';
    if (status === 'featured') where = 'WHERE is_featured = TRUE';
    const result = await pool.query(
      `SELECT * FROM reviews ${where} ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Admin: PATCH /api/admin/reviews/:id
const updateReview = async (req, res) => {
  try {
    const { is_approved, is_featured, reply } = req.body;
    const sets = ['updated_at = NOW()'];
    const params = [];

    if (is_approved !== undefined) { params.push(is_approved); sets.push(`is_approved = $${params.length}`); }
    if (is_featured !== undefined) { params.push(is_featured); sets.push(`is_featured = $${params.length}`); }
    if (reply !== undefined)       { params.push(reply);        sets.push(`reply = $${params.length}`); }

    if (params.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE reviews SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Review not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Admin: DELETE /api/admin/reviews/:id
const deleteReview = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM reviews WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Review not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { getReviews, submitReview, getAdminReviews, updateReview, deleteReview };

