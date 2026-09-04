const safeError = require('../utils/safeError');
const pool = require('../config/db');
const { sendBackInStockAlert, toE164 } = require('../services/smsService');
const { sendBackInStockEmail } = require('../services/emailService');

// Guest-friendly, same shape as reviewsController.submitReview: nullable
// user_id, contact fields required instead. Rejects an item that isn't
// currently, actually sold out -- there's nothing to wait for otherwise,
// and this doubles as validation that menu_item_id is a real menus row.
const joinWaitlist = async (req, res) => {
  const { menu_item_id, email, phone } = req.body;
  const menuItemId = parseInt(menu_item_id, 10);
  if (!menuItemId) return res.status(400).json({ message: 'menu_item_id is required.' });
  if (!email && !phone) return res.status(400).json({ message: 'An email or phone number is required.' });

  try {
    const soldOutRes = await pool.query(
      `SELECT 1 FROM menu_location_availability WHERE menu_id = $1 AND status = 'sold_out' LIMIT 1`,
      [menuItemId]
    );
    if (!soldOutRes.rows.length) {
      return res.status(400).json({ message: 'That item is not currently sold out.' });
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase().slice(0, 255) : null;
    const normalizedPhone = phone ? toE164(String(phone).trim()) : null;
    const userId = req.user?.id || null;

    // Dedupe against an existing pending signup for the same person on the
    // same item -- a double-submit is harmless, not a second entry.
    const existing = await pool.query(
      `SELECT id FROM item_waitlist
        WHERE menu_item_id = $1 AND notified_at IS NULL
          AND ((user_id IS NOT NULL AND user_id = $2)
            OR (email IS NOT NULL AND email = $3)
            OR (phone IS NOT NULL AND phone = $4))
        LIMIT 1`,
      [menuItemId, userId, normalizedEmail, normalizedPhone]
    );
    if (existing.rows.length) {
      return res.status(200).json({ success: true, alreadyOnList: true });
    }

    await pool.query(
      `INSERT INTO item_waitlist (menu_item_id, user_id, email, phone) VALUES ($1, $2, $3, $4)`,
      [menuItemId, userId, normalizedEmail, normalizedPhone]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Fire-and-forget, called from inventoryController.syncMenuAvailability when
// an item transitions sold_out -> available. Best-effort per recipient --
// one failed send shouldn't block the rest of the list from being notified.
const notifyWaitlist = async (menuItemId) => {
  const itemRes = await pool.query(`SELECT name FROM menus WHERE id = $1`, [menuItemId]);
  const itemName = itemRes.rows[0]?.name;
  if (!itemName) return;

  const pending = await pool.query(
    `SELECT id, email, phone FROM item_waitlist WHERE menu_item_id = $1 AND notified_at IS NULL`,
    [menuItemId]
  );
  if (!pending.rows.length) return;

  for (const entry of pending.rows) {
    if (entry.email) {
      sendBackInStockEmail(entry.email, itemName).catch(err => console.error('[Waitlist] Email send failed:', err.message));
    }
    if (entry.phone) {
      // Hard opt-out (Twilio STOP) always wins -- but this is not gated on
      // the marketing-broadcast preference (receive_sms_updates), since the
      // customer explicitly asked to be texted about this specific item.
      pool.query(
        `SELECT 1 FROM sms_optouts WHERE phone_digits = regexp_replace($1, '[^0-9]', '', 'g')`,
        [entry.phone]
      ).then(optOutRes => {
        if (!optOutRes.rows.length) {
          return sendBackInStockAlert(entry.phone, itemName);
        }
      }).catch(err => console.error('[Waitlist] SMS send failed:', err.message));
    }
  }

  await pool.query(
    `UPDATE item_waitlist SET notified_at = NOW() WHERE menu_item_id = $1 AND notified_at IS NULL`,
    [menuItemId]
  );
};

// Admin: pending-signup counts per item, for a small "N waiting" badge in
// the Inventory page -- not a full management view, matches the feature's
// actual admin-facing value (informational, helps prioritize restocking).
const getWaitlistCounts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT menu_item_id, COUNT(*)::int AS count
         FROM item_waitlist
        WHERE notified_at IS NULL
        GROUP BY menu_item_id`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

module.exports = { joinWaitlist, notifyWaitlist, getWaitlistCounts };
