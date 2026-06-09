const safeError = require('../utils/safeError');
const pool = require('../config/db');
const emailService = require('../services/emailService');

const PRICE_PER_HEAD = (guests) => {
  if (guests >= 100) return 12;
  if (guests >= 51)  return 14;
  if (guests >= 31)  return 16;
  return 18;
};

// 1. Submit a catering / event quote inquiry (Public)
const createReservation = async (req, res) => {
  try {
    const {
      name, email, phone,
      event_type, event_date, guest_count, service_type,
      notes,
    } = req.body;

    if (!name || !email || !event_date || !guest_count) {
      return res.status(400).json({ message: 'name, email, event_date, and guest_count are required' });
    }

    const guests = parseInt(guest_count) || 1;
    const estimated_total = Math.max(200, guests * PRICE_PER_HEAD(guests));

    const result = await pool.query(
      `INSERT INTO reservations
         (name, email, phone, party_size, scheduled_date,
          event_type, service_type, estimated_total, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
       RETURNING *`,
      [
        name.trim(),
        email.trim(),
        phone?.trim() || '',
        guests,
        event_date,
        event_type || 'Event',
        service_type || 'delivery',
        estimated_total,
        notes?.trim() || '',
      ]
    );

    const quote = result.rows[0];

    // Notify customer
    emailService.sendCateringQuoteConfirmation(email, name, quote).catch(err =>
      console.error('[Catering] Customer email failed:', err.message)
    );

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || 'admin@habibihalal.com';
    emailService.sendCateringAdminAlert(adminEmail, quote).catch(err =>
      console.error('[Catering] Admin alert failed:', err.message)
    );

    res.status(201).json({
      message: 'Catering inquiry submitted successfully',
      data: quote,
      estimated_total,
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 2. Get all reservations, optionally filtered by type (Admin)
const getAllReservations = async (req, res) => {
  try {
    const { type } = req.query;
    let where = '';
    if (type === 'table')   where = "WHERE service_type = 'table_reservation'";
    if (type === 'catering') where = "WHERE service_type != 'table_reservation' OR service_type IS NULL";
    const result = await pool.query(
      `SELECT * FROM reservations ${where} ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 3. Get single quote (Admin)
const getReservationById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM reservations WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Quote not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 4. Update status + optional admin notes (Admin)
const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, quoted_price } = req.body;
    const result = await pool.query(
      `UPDATE reservations
       SET status      = COALESCE($1, status),
           admin_notes = COALESCE($2, admin_notes),
           quoted_price = COALESCE($3, quoted_price),
           updated_at  = NOW()
       WHERE id = $4
       RETURNING *`,
      [status || null, admin_notes || null, quoted_price || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Quote not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 5. Send custom invoice email to customer (Admin)
const sendInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { quoted_price, invoice_notes } = req.body;

    const result = await pool.query(
      `UPDATE reservations
       SET quoted_price = COALESCE($1, estimated_total),
           invoice_sent = TRUE,
           admin_notes  = COALESCE($2, admin_notes),
           status       = CASE WHEN status = 'pending' THEN 'quoted' ELSE status END,
           updated_at   = NOW()
       WHERE id = $3
       RETURNING *`,
      [quoted_price || null, invoice_notes || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Quote not found' });
    const quote = result.rows[0];

    await emailService.sendCateringInvoice(
      quote.email,
      quote.name,
      quote,
      invoice_notes || ''
    );

    res.json({ message: 'Invoice sent successfully', data: quote });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// 6. Table reservation (Public — dine-in booking)
const createTableReservation = async (req, res) => {
  try {
    const { name, contact, location, date, time, party, notes } = req.body;
    const email = contact.includes('@') ? contact.trim() : '';
    const phone = !contact.includes('@') ? contact.trim() : '';
    const fullNotes = [`Time: ${time}`, `Location: ${location}`, notes ? `Notes: ${notes}` : null]
      .filter(Boolean).join(' | ');

    const result = await pool.query(
      `INSERT INTO reservations
         (name, email, phone, party_size, scheduled_date,
          event_type, service_type, estimated_total, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,'table_reservation',0,$7,'pending')
       RETURNING id`,
      [name.trim(), email, phone, parseInt(party), date, location, fullNotes]
    );

    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || 'admin@habibihalal.com';
    emailService.sendCateringAdminAlert(adminEmail, {
      ...result.rows[0], name, email, phone, party_size: party,
      scheduled_date: date, event_type: `Table — ${location} @ ${time}`,
    }).catch(() => {});

    res.status(201).json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  createReservation,
  createTableReservation,
  getAllReservations,
  getReservationById,
  updateReservationStatus,
  sendInvoice,
};
