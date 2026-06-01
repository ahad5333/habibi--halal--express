const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Resume upload storage ──────────────────────────────────────────────────
const resumeDir = path.join(__dirname, '../../public/uploads/resumes');
if (!fs.existsSync(resumeDir)) fs.mkdirSync(resumeDir, { recursive: true });

const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, resumeDir),
  filename: (_req, file, cb) => {
    const stamp = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'resume-' + stamp + path.extname(file.originalname));
  },
});

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  },
}).single('resume');

// ── Public: GET /api/careers/vacancies ────────────────────────────────────
const getVacancies = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, department, location, type, description, requirements, salary_range, created_at
       FROM job_vacancies
       WHERE is_active = TRUE
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Public: POST /api/careers/apply ───────────────────────────────────────
const submitApplication = (req, res) => {
  uploadResume(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }
    try {
      const { name, email, phone, role_applied, vacancy_id, cover_message } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }
      const resumeUrl = req.file
        ? `/uploads/resumes/${req.file.filename}`
        : null;

      const result = await pool.query(
        `INSERT INTO job_applications
           (vacancy_id, name, email, phone, role_applied, cover_message, resume_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id`,
        [vacancy_id || null, name, email, phone || null, role_applied || null, cover_message || null, resumeUrl]
      );
      res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};

// ── Admin: GET /api/admin/careers/vacancies ───────────────────────────────
const getAdminVacancies = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM job_vacancies ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: POST /api/admin/careers/vacancies ──────────────────────────────
const createVacancy = async (req, res) => {
  try {
    const { title, department, location, type, description, requirements, salary_range, is_active } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const result = await pool.query(
      `INSERT INTO job_vacancies (title, department, location, type, description, requirements, salary_range, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [title, department || null, location || 'Bronx, NY', type || 'full-time', description || null, requirements || null, salary_range || null, is_active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: PATCH /api/admin/careers/vacancies/:id ─────────────────────────
const updateVacancy = async (req, res) => {
  try {
    const { title, department, location, type, description, requirements, salary_range, is_active } = req.body;
    const result = await pool.query(
      `UPDATE job_vacancies
       SET title=$1, department=$2, location=$3, type=$4, description=$5,
           requirements=$6, salary_range=$7, is_active=$8, updated_at=NOW()
       WHERE id=$9
       RETURNING *`,
      [title, department, location, type, description, requirements, salary_range, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Vacancy not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: DELETE /api/admin/careers/vacancies/:id ────────────────────────
const deleteVacancy = async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM job_vacancies WHERE id=$1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Vacancy not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: GET /api/admin/careers/applications ────────────────────────────
const getApplications = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE ja.status = $1`;
    }
    const result = await pool.query(
      `SELECT ja.*, jv.title AS vacancy_title
       FROM job_applications ja
       LEFT JOIN job_vacancies jv ON jv.id = ja.vacancy_id
       ${where}
       ORDER BY ja.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: PATCH /api/admin/careers/applications/:id/status ──────────────
const updateApplicationStatus = async (req, res) => {
  const { status, notes } = req.body;
  const allowed = ['pending', 'reviewed', 'shortlisted', 'rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      `UPDATE job_applications
       SET status=$1, notes=$2, updated_at=NOW()
       WHERE id=$3
       RETURNING *`,
      [status, notes || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Application not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getVacancies,
  submitApplication,
  getAdminVacancies,
  createVacancy,
  updateVacancy,
  deleteVacancy,
  getApplications,
  updateApplicationStatus,
};
