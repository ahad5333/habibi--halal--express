const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const safeError = require('../utils/safeError');
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const emailService = require('../services/emailService');

const PRICE_TIER_LABELS = { tier_1: 'Standard', tier_2: 'Silver', tier_3: 'Gold' };

// Ensure documents directory exists
const uploadDir = path.join(__dirname, "../../uploads/partners");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const rand = crypto.randomBytes(16).toString('hex');
    cb(null, `partner-${rand}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only images and PDFs are allowed"), false);
    }
  }
});

const submitPartnerApplication = async (req, res) => {
  const { business_name, ein_number, contact_name, email, phone, address } = req.body;
  const certificate_url = req.file ? `/uploads/partners/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      `INSERT INTO partner_applications 
       (business_name, ein_number, contact_name, email, phone, address, certificate_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [business_name, ein_number, contact_name, email, phone, address, certificate_url]
    );

    res.status(201).json({
      success: true,
      message: "Application submitted successfully. Our team will review it within 2-3 business days.",
      application: result.rows[0]
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getPartnerApplications = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM partner_applications ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status, price_tier, notes, payment_methods, credit_balance } = req.body;

  const pmethods = Array.isArray(payment_methods) ? JSON.stringify(payment_methods) : (payment_methods ?? null);
  const balance  = credit_balance !== undefined && credit_balance !== '' ? parseFloat(credit_balance) : null;

  const client = await pool.connect();
  let app, prevStatus, setupUrl = null, accountCreated = false;
  try {
    await client.query('BEGIN');

    const prevRes = await client.query('SELECT status FROM partner_applications WHERE id = $1 FOR UPDATE', [id]);
    if (prevRes.rows.length === 0) throw new Error("Application not found");
    prevStatus = prevRes.rows[0].status;

    const result = await client.query(
      `UPDATE partner_applications
          SET status           = $1,
              price_tier       = $2,
              notes            = $3,
              payment_methods  = COALESCE($5::jsonb, payment_methods),
              credit_balance   = COALESCE($6, credit_balance),
              updated_at       = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`,
      [status, price_tier, notes, id, pmethods, balance]
    );
    app = result.rows[0];

    if (status === 'approved' && prevStatus !== 'approved') {
      // Fresh approval (or re-approval after rejection) — find-or-create the login
      // account. Most applicants apply via the public /wholesale form and never had
      // an account, so "find by email" alone (the old behavior) silently did nothing.
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [app.email]);
      let userId;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        await client.query('UPDATE users SET is_partner = TRUE, partner_id = $1 WHERE id = $2', [id, userId]);
      } else {
        const hashed = await bcrypt.hash(crypto.randomUUID(), 12);
        const created = await client.query(
          `INSERT INTO users (name, email, phone_number, password_hash, role, is_partner, partner_id, email_verified)
           VALUES ($1, $2, $3, $4, 'business', TRUE, $5, TRUE)
           RETURNING id`,
          [app.contact_name || app.business_name || null, app.email, app.phone || null, hashed, id]
        );
        userId = created.rows[0].id;
        accountCreated = true;
      }

      if (accountCreated) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expires = new Date(Date.now() + 24 * 3600000);
        await client.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [tokenHash, expires, userId]);
        const frontendUrl = process.env.FRONTEND_URL || 'https://habibihe.com';
        setupUrl = `${frontendUrl}/reset-password?token=${token}&type=partner`;
      }
    }

    if (status !== 'approved' && prevStatus === 'approved') {
      // Revoking previously-approved access — keep the account, just cut off the portal
      await client.query('UPDATE users SET is_partner = FALSE WHERE email = $1', [app.email]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json(safeError(error));
  } finally {
    client.release();
  }

  // Notification emails fire after commit, only on a real status transition —
  // editing price tier/notes on an already-approved partner shouldn't resend one.
  if (status === 'approved' && prevStatus !== 'approved') {
    emailService.sendPartnerApplicationApproved(app.email, {
      contact_name: app.contact_name,
      business_name: app.business_name,
      price_tier_label: PRICE_TIER_LABELS[app.price_tier] || null,
      setupUrl,
    }).catch(err => console.error('[Partners] approval email failed:', err.message));
  } else if (status === 'rejected' && prevStatus !== 'rejected') {
    emailService.sendPartnerApplicationRejected(app.email, {
      contact_name: app.contact_name,
      business_name: app.business_name,
      notes: app.notes,
      wasApproved: prevStatus === 'approved',
    }).catch(err => console.error('[Partners] rejection email failed:', err.message));
  }

  res.json({ success: true, application: app, account_created: accountCreated });
};

module.exports = {
  submitPartnerApplication,
  getPartnerApplications,
  updateApplicationStatus,
  upload
};
