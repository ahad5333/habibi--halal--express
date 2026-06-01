const safeError = require('../utils/safeError');
const pool = require('../config/db');

// Helper for distance calculation (Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const getAllLocations = async (req, res) => {
  const { lat, lng } = req.query;
  
  try {
    let query = 'SELECT * FROM locations WHERE is_active = true';
    let params = [];

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (lat && lng && !isNaN(parsedLat) && !isNaN(parsedLng)) {
      query = `
        SELECT *, 
        (3959 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) AS distance 
        FROM locations 
        WHERE is_active = true 
        ORDER BY distance ASC, preference_level DESC
      `;
      params = [parsedLat, parsedLng];
    } else {
      query += ' ORDER BY preference_level DESC, title ASC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve locations' });
  }
};

const getLocationById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve location' });
  }
};

const createLocation = async (req, res) => {
  const { title, exact_address, brief_address, latitude, longitude, phone_number, working_days_hours, delivery_radius_miles, is_active, preference_level } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO locations (title, exact_address, brief_address, latitude, longitude, phone_number, working_days_hours, delivery_radius_miles, is_active, preference_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [title, exact_address, brief_address || exact_address, latitude, longitude, phone_number, working_days_hours, delivery_radius_miles, is_active !== false, preference_level || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create location' });
  }
};

const updateLocation = async (req, res) => {
  const { id } = req.params;
  const { title, exact_address, brief_address, latitude, longitude, phone_number, working_days_hours, delivery_radius_miles, is_active, preference_level, self_delivery_radius, preference_score, image_url,
    holidays, tablet_username, tablet_password,
    partner_ubereats, partner_doordash, partner_grubhub, partner_roadie, partner_self } = req.body;

  const db_title = title;
  const db_address = exact_address || brief_address;
  const db_phone = phone_number;
  const db_hours = working_days_hours;
  const db_radius = delivery_radius_miles || self_delivery_radius;
  const db_pref = preference_level || preference_score;

  try {
    const result = await pool.query(
      `UPDATE locations SET
        title = COALESCE($1, title),
        exact_address = COALESCE($2, exact_address),
        brief_address = COALESCE($3, brief_address),
        latitude = COALESCE($4, latitude),
        longitude = COALESCE($5, longitude),
        phone_number = COALESCE($6, phone_number),
        working_days_hours = COALESCE($7, working_days_hours),
        delivery_radius_miles = COALESCE($8, delivery_radius_miles),
        is_active = COALESCE($9, is_active),
        preference_level = COALESCE($10, preference_level),
        image_url = COALESCE(NULLIF($11, ''), image_url),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 RETURNING *`,
      [db_title, db_address, db_address, latitude, longitude, db_phone, db_hours, db_radius, is_active, db_pref, image_url || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update location' });
  }
};

const deleteLocation = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM locations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
};

const findBestLocation = async (req, res) => {
  const { lat, lng } = req.query;
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  
  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM locations WHERE is_active = true');
    let bestLoc = null;
    let minDistance = Infinity;

    for (let loc of result.rows) {
      const dist = calculateDistance(parsedLat, parsedLng, parseFloat(loc.latitude), parseFloat(loc.longitude));
      if (dist <= parseFloat(loc.delivery_radius_miles)) {
        if (dist < minDistance) {
          minDistance = dist;
          bestLoc = loc;
        }
      }
    }

    if (bestLoc) {
      res.json({ ...bestLoc, distance: minDistance });
    } else {
      res.status(404).json({ error: 'No delivery location found within radius' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to find best location' });
  }
};

module.exports = {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  findBestLocation,
  calculateDistance
};
