const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { isOpenNow } = require('../utils/businessHours');

// ── Day metadata ──────────────────────────────────────────────────────────────
const DAY_NAMES   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Default hours returned when the table doesn't exist yet or a location has no rows
function defaultHours(locationId) {
  return Array.from({ length: 7 }, (_, i) => ({
    location_id: locationId,
    day_of_week: i,
    open_time:   '07:00',
    close_time:  '23:00',
    is_closed:   false,
    is_24h:      false,
  }));
}

// ── Format a TIME column value (HH:MM:SS or HH:MM) to "7:00 AM" ──────────────
function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const suffix = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ── Build human-readable working_days_hours text from 7 rows ─────────────────
// Compresses consecutive days with identical hours into ranges.
// Example: "Mon–Fri: 7:00 AM – 11:00 PM · Sat–Sun: Closed"
function buildHoursText(rows) {
  // Sort by day_of_week 0–6
  const sorted = [...rows].sort((a, b) => a.day_of_week - b.day_of_week);

  // Group consecutive days with the same schedule
  const groups = [];
  let group = null;

  for (const row of sorted) {
    const key = row.is_24h
      ? '24h'
      : row.is_closed
      ? 'closed'
      : `${row.open_time}|${row.close_time}`;

    if (group && group.key === key) {
      group.end = row.day_of_week;
    } else {
      if (group) groups.push(group);
      group = { key, start: row.day_of_week, end: row.day_of_week, row };
    }
  }
  if (group) groups.push(group);

  const parts = groups.map(g => {
    const dayLabel =
      g.start === g.end
        ? DAY_ABBR[g.start]
        : `${DAY_ABBR[g.start]}–${DAY_ABBR[g.end]}`;

    if (g.key === '24h')     return `${dayLabel}: Open 24 Hours`;
    if (g.key === 'closed')  return `${dayLabel}: Closed`;
    return `${dayLabel}: ${formatTime12(g.row.open_time)} – ${formatTime12(g.row.close_time)}`;
  });

  return parts.join(' · ');
}

// ── GET /api/admin/business-hours?location_id=X ───────────────────────────────
exports.getBusinessHours = async (req, res) => {
  const locationId = parseInt(req.query.location_id, 10);
  if (!locationId || isNaN(locationId)) {
    return res.status(400).json({ error: 'location_id is required' });
  }

  try {
    const result = await pool.query(
      `SELECT location_id, day_of_week, open_time, close_time, is_closed, is_24h
         FROM business_hours
        WHERE location_id = $1
        ORDER BY day_of_week`,
      [locationId]
    );

    const rows = result.rows.length === 7
      ? result.rows
      : defaultHours(locationId);

    res.json({ location_id: locationId, hours: rows });
  } catch (err) {
    // Table may not exist yet — return defaults gracefully
    if (err.code === '42P01') {
      return res.json({ location_id: locationId, hours: defaultHours(locationId) });
    }
    res.status(500).json(safeError(err));
  }
};

// ── PUT /api/admin/business-hours ─────────────────────────────────────────────
exports.saveBusinessHours = async (req, res) => {
  const { location_id, hours } = req.body;

  if (!location_id || !Array.isArray(hours) || hours.length !== 7) {
    return res.status(400).json({ error: 'location_id and hours[7] are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // UPSERT all 7 rows
    for (const h of hours) {
      const { day_of_week, open_time, close_time, is_closed, is_24h } = h;
      if (day_of_week < 0 || day_of_week > 6) continue;

      // Coerce — DB defaults apply if undefined
      const ot = open_time  || '07:00';
      const ct = close_time || '23:00';

      await client.query(
        `INSERT INTO business_hours (location_id, day_of_week, open_time, close_time, is_closed, is_24h)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (location_id, day_of_week)
         DO UPDATE SET
           open_time  = EXCLUDED.open_time,
           close_time = EXCLUDED.close_time,
           is_closed  = EXCLUDED.is_closed,
           is_24h     = EXCLUDED.is_24h`,
        [location_id, day_of_week, ot, ct, !!is_closed, !!is_24h]
      );
    }

    // Regenerate working_days_hours text and update locations table
    const hoursText = buildHoursText(hours.map(h => ({
      day_of_week: h.day_of_week,
      open_time:   h.open_time  || '07:00',
      close_time:  h.close_time || '23:00',
      is_closed:   !!h.is_closed,
      is_24h:      !!h.is_24h,
    })));

    await client.query(
      `UPDATE locations SET working_days_hours = $1 WHERE id = $2`,
      [hoursText, location_id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Business hours saved', working_days_hours: hoursText });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'business_hours table not yet created. Run the migration first.' });
    }
    res.status(500).json(safeError(err));
  } finally {
    client.release();
  }
};

// ── GET /api/business-hours  (PUBLIC) ─────────────────────────────────────────
exports.getPublicBusinessHours = async (req, res) => {
  try {
    // Fetch all locations
    const locResult = await pool.query(
      `SELECT id, title, working_days_hours, accepting_orders FROM locations ORDER BY id`
    );
    const locations = locResult.rows;

    let hoursMap = {};
    try {
      const bhResult = await pool.query(
        `SELECT location_id, day_of_week, open_time, close_time, is_closed, is_24h
           FROM business_hours
          ORDER BY location_id, day_of_week`
      );
      for (const row of bhResult.rows) {
        if (!hoursMap[row.location_id]) hoursMap[row.location_id] = [];
        hoursMap[row.location_id].push(row);
      }
    } catch (bhErr) {
      // business_hours table doesn't exist yet — fall back to defaults
      if (bhErr.code !== '42P01') throw bhErr;
    }

    const result = locations.map(loc => {
      const hours = (hoursMap[loc.id] && hoursMap[loc.id].length === 7)
        ? hoursMap[loc.id]
        : defaultHours(loc.id);

      return {
        location_id:        loc.id,
        title:              loc.title,
        working_days_hours: loc.working_days_hours,
        accepting_orders:   loc.accepting_orders,
        is_open_now:        isOpenNow(loc.working_days_hours),
        hours,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
};
