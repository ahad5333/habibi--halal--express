const pool = require('../config/db');

// The deals any customer may see: what the public Offers page lists, and what
// the assistant reads out when someone asks "any deals today?". One query so
// the two can never disagree.
//
// Personal coupons (customer_email set) are excluded. Only their owner can
// redeem one, and the birthday reward's title carries the customer's first
// name ("Happy Birthday, Sara!"), so the old public query -- which had no such
// filter -- would have listed every issued birthday coupon, name and code, on
// the Offers page for anyone to read. expiry_date is honoured too: the
// birthday flow sets it instead of valid_until, and the old query ignored it.
async function getPublicOffers(limit = 20) {
  const { rows } = await pool.query(`
    SELECT
      code,
      discount_type,
      discount_value::float                                                   AS discount_value,
      CASE WHEN condition_type = 'min_order' THEN condition_value::float
           ELSE NULL END                                                      AS min_order,
      COALESCE(title,
        CASE
          WHEN discount_type = 'percentage'                THEN ROUND(discount_value)::text || '% Off Your Order'
          WHEN discount_type IN ('fixed_amount', 'fixed')  THEN '$' || ROUND(discount_value)::text || ' Off Your Order'
          WHEN discount_type = 'free_delivery'             THEN 'Free Delivery on Your Order'
          ELSE 'Special Offer'
        END
      )                                                                       AS title,
      COALESCE(description, 'Use this code at checkout to claim your discount.') AS description,
      CASE
        WHEN discount_type = 'percentage'                THEN ROUND(discount_value)::text || '%'
        WHEN discount_type IN ('fixed_amount', 'fixed')  THEN '$' || ROUND(discount_value)::text
        WHEN discount_type = 'free_delivery'             THEN 'FREE DELIVERY'
        ELSE discount_value::text
      END                                                                     AS value_display,
      valid_until                                                             AS expires_at,
      COALESCE(is_first_order_only, FALSE)                                    AS first_order_only
    FROM coupons
    WHERE is_active = TRUE
      AND customer_email IS NULL
      AND (usage_limit IS NULL OR used_count < usage_limit)
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

module.exports = { getPublicOffers };
