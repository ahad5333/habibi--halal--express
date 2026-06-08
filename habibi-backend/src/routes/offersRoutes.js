const safeError = require('../utils/safeError');
const express = require("express");
const router  = express.Router();
const pool    = require("../config/db");

/* ── GET /api/offers — public, no auth ── */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        code,
        discount_type,
        discount_value::float                                                   AS discount_value,
        CASE WHEN condition_type = 'min_order' THEN condition_value::float
             ELSE NULL END                                                      AS min_order,
        COALESCE(title,
          CASE discount_type
            WHEN 'percentage'    THEN ROUND(discount_value)::text || '% Off Your Order'
            WHEN 'fixed_amount'  THEN '$' || ROUND(discount_value)::text || ' Off Your Order'
            WHEN 'free_delivery' THEN 'Free Delivery on Your Order'
            ELSE 'Special Offer'
          END
        )                                                                       AS title,
        COALESCE(description, 'Use this code at checkout to claim your discount.') AS description,
        CASE discount_type
          WHEN 'percentage'    THEN ROUND(discount_value)::text || '%'
          WHEN 'fixed_amount'  THEN '$' || ROUND(discount_value)::text
          WHEN 'free_delivery' THEN 'FREE DELIVERY'
          ELSE discount_value::text
        END                                                                     AS value_display,
        valid_until                                                             AS expires_at
      FROM coupons
      WHERE is_active = TRUE
        AND (usage_limit IS NULL OR used_count < usage_limit)
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (valid_from IS NULL OR valid_from <= NOW())
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;

