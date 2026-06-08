const crypto = require('crypto');
const safeError = require('../utils/safeError');
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
  const { status, price_tier, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      "UPDATE partner_applications SET status = $1, price_tier = $2, notes = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
      [status, price_tier, notes, id]
    );

    if (result.rows.length === 0) {
      throw new Error("Application not found");
    }

    const app = result.rows[0];

    // If approved, find user by email and upgrade to partner
    if (status === 'approved') {
      await client.query(
        "UPDATE users SET is_partner = TRUE, partner_id = $1 WHERE email = $2",
        [id, app.email]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, application: app });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json(safeError(error));
  } finally {
    client.release();
  }
};

module.exports = {
  submitPartnerApplication,
  getPartnerApplications,
  updateApplicationStatus,
  upload
};
