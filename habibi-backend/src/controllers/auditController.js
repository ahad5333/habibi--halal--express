const safeError = require('../utils/safeError');
const pool = require('../config/db');

exports.getAuditLog = async (req, res) => {
  try {
    const { limit = 100, offset = 0, entity_type } = req.query;
    const conditions = [];
    const params = [];
    if (entity_type) {
      params.push(entity_type);
      conditions.push(`entity_type = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(
      `SELECT * FROM admin_audit_log ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};

// Middleware helper — called manually from other controllers
exports.logAudit = async (pool, adminId, adminName, action, entityType, entityId, details, ip) => {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log (admin_id, admin_name, action, entity_type, entity_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [adminId || null, adminName || 'Admin', action, entityType || null,
       String(entityId || ''), JSON.stringify(details || {}), ip || null]
    );
  } catch (_) {}
};
