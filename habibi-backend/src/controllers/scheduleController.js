const pool = require('../config/db');
const safeError = require('../utils/safeError');
const { logAudit } = require('./auditController');
const { sendSMS, toE164 } = require('../services/smsService');

// ── Staff scheduling ──────────────────────────────────────────────────────────
// Weekly shift planner (CPanel), each person's shifts in their own app, texts
// when a week is posted or changed, clock in/out with an hours report, and
// time-off requests. All dates and times are New York wall-clock.

const TZ = 'America/New_York';
const NY_TODAY = `(NOW() AT TIME ZONE '${TZ}')::date`;
// A shift's real start/end instants; an end at or before the start is the next day.
const SHIFT_START = (a = 's') => `((${a}.shift_date + ${a}.start_time) AT TIME ZONE '${TZ}')`;
const SHIFT_END = (a = 's') => `((${a}.shift_date + ${a}.end_time + CASE WHEN ${a}.end_time <= ${a}.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END) AT TIME ZONE '${TZ}')`;
const SHIFT_HOURS = (a = 's') => `(EXTRACT(EPOCH FROM (${a}.end_time - ${a}.start_time + CASE WHEN ${a}.end_time <= ${a}.start_time THEN INTERVAL '24 hours' ELSE INTERVAL '0' END)) / 3600)`;
const LATE_GRACE_MIN = 5;
const MISSING_CLOCK_OUT_HOURS = 16;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const err = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });
const send = (res, e) => (e.statusCode
  ? res.status(e.statusCode).json({ message: e.message, ...e.extra })
  : res.status(500).json(safeError(e)));

function todayNY() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Monday of the week containing `ymd` (or today, New York).
function weekStart(ymd) {
  const base = DAY_RE.test(ymd || '') ? ymd : todayNY();
  const dow = new Date(`${base}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(base, dow === 0 ? -6 : 1 - dow);
}
const fmtDay = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const fmtTime = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
};

// ── Clock in/out (shared by staff app, driver duty and CPanel) ───────────────
// Links the entry to the person's nearest shift that starts within 4 hours
// either side, so the hours report can flag late arrivals.
async function clockIn(staffId, source) {
  const open = await pool.query('SELECT clock_in FROM time_clock WHERE staff_id = $1 AND clock_out IS NULL', [staffId]);
  if (open.rows.length) throw err(409, 'You are already clocked in.', { clock_in: open.rows[0].clock_in });
  const shift = await pool.query(
    `SELECT s.id FROM staff_shifts s
      WHERE s.staff_id = $1 AND s.shift_date BETWEEN ${NY_TODAY} - 1 AND ${NY_TODAY} + 1
        AND ${SHIFT_START()} BETWEEN NOW() - INTERVAL '4 hours' AND NOW() + INTERVAL '4 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (${SHIFT_START()} - NOW()))) LIMIT 1`,
    [staffId]
  );
  const r = await pool.query(
    `INSERT INTO time_clock (staff_id, shift_id, clock_in, source) VALUES ($1, $2, NOW(), $3) RETURNING *`,
    [staffId, shift.rows[0]?.id || null, source]
  );
  return r.rows[0];
}

async function clockOut(staffId) {
  const r = await pool.query(
    `UPDATE time_clock SET clock_out = NOW() WHERE staff_id = $1 AND clock_out IS NULL RETURNING *`, [staffId]
  );
  if (!r.rows.length) throw err(409, "You aren't clocked in.");
  return r.rows[0];
}

// Drivers clock in and out by going on and off duty. Best-effort: a clock
// problem must never block the duty toggle itself.
exports.syncDriverDuty = async (driverId, onDuty) => {
  try {
    if (onDuty) await clockIn(driverId, 'driver_duty');
    else await clockOut(driverId);
  } catch (e) {
    if (e.statusCode !== 409) console.error('[Schedule] driver duty clock sync failed:', e.message);
  }
};

// ── One person's own view (staff app / driver app) ───────────────────────────
async function myScheduleData(staffId) {
  const [shifts, open, timeOff] = await Promise.all([
    pool.query(
      `SELECT s.id, to_char(s.shift_date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS start_time,
              to_char(s.end_time, 'HH24:MI') AS end_time, s.note, l.title AS location,
              ${SHIFT_START()} <= NOW() AND ${SHIFT_END()} > NOW() AS is_now
         FROM staff_shifts s LEFT JOIN locations l ON l.id = s.location_id
        WHERE s.staff_id = $1 AND s.shift_date BETWEEN ${NY_TODAY} - 1 AND ${NY_TODAY} + 14
          AND ${SHIFT_END()} > NOW()
        ORDER BY s.shift_date, s.start_time`, [staffId]),
    pool.query('SELECT id, clock_in, source FROM time_clock WHERE staff_id = $1 AND clock_out IS NULL', [staffId]),
    pool.query(
      `SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date,
              reason, status, decision_note, created_at
         FROM time_off_requests
        WHERE staff_id = $1 AND (end_date >= ${NY_TODAY} - 30)
        ORDER BY start_date DESC LIMIT 20`, [staffId]),
  ]);
  return { shifts: shifts.rows, clocked_in: open.rows[0] || null, time_off: timeOff.rows };
}

async function requestTimeOff(staffId, body) {
  const { start_date, end_date } = body || {};
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : null;
  if (!DAY_RE.test(start_date || '') || !DAY_RE.test(end_date || '')) throw err(400, 'Choose the first and last day off.');
  if (end_date < start_date) throw err(400, 'The last day off is before the first.');
  if (start_date < todayNY()) throw err(400, "Time off can't start in the past.");
  if (addDays(start_date, 60) < end_date) throw err(400, 'Requests are limited to 60 days at a time.');
  const clash = await pool.query(
    `SELECT 1 FROM time_off_requests WHERE staff_id = $1 AND status IN ('pending', 'approved')
       AND start_date <= $3 AND end_date >= $2 LIMIT 1`, [staffId, start_date, end_date]);
  if (clash.rows.length) throw err(409, 'You already have time off requested for some of those days.');
  const r = await pool.query(
    `INSERT INTO time_off_requests (staff_id, start_date, end_date, reason) VALUES ($1, $2, $3, $4) RETURNING id`,
    [staffId, start_date, end_date, reason || null]);
  return r.rows[0];
}

async function cancelTimeOff(staffId, id) {
  const r = await pool.query(
    `UPDATE time_off_requests SET status = 'cancelled' WHERE id = $1 AND staff_id = $2 AND status = 'pending' RETURNING id`,
    [id, staffId]);
  if (!r.rows.length) throw err(409, 'Only your own pending requests can be cancelled.');
}

// Staff PIN screen (req.staffId from staffMiddleware)
exports.staffMe = async (req, res) => { try { res.json(await myScheduleData(req.staffId)); } catch (e) { send(res, e); } };
exports.staffClockIn = async (req, res) => { try { res.json(await clockIn(req.staffId, 'app')); } catch (e) { send(res, e); } };
exports.staffClockOut = async (req, res) => { try { res.json(await clockOut(req.staffId)); } catch (e) { send(res, e); } };
exports.staffRequestTimeOff = async (req, res) => { try { res.status(201).json(await requestTimeOff(req.staffId, req.body)); } catch (e) { send(res, e); } };
exports.staffCancelTimeOff = async (req, res) => { try { await cancelTimeOff(req.staffId, parseInt(req.params.id, 10)); res.json({ success: true }); } catch (e) { send(res, e); } };

// Driver app (req.driverId from dispatchRoutes' driverOrAdmin). Drivers
// clock in by going on duty, so there's no clock route here.
const driverSelf = (req) => {
  const id = req.isAdmin ? parseInt(req.params.driver_id, 10) : req.driverId;
  if (!id || (!req.isAdmin && String(id) !== String(req.params.driver_id))) throw err(403, 'Not your schedule.');
  return id;
};
exports.driverMe = async (req, res) => { try { res.json(await myScheduleData(driverSelf(req))); } catch (e) { send(res, e); } };
exports.driverRequestTimeOff = async (req, res) => { try { res.status(201).json(await requestTimeOff(driverSelf(req), req.body)); } catch (e) { send(res, e); } };
exports.driverCancelTimeOff = async (req, res) => { try { await cancelTimeOff(driverSelf(req), parseInt(req.params.id, 10)); res.json({ success: true }); } catch (e) { send(res, e); } };

// ── CPanel: planner ───────────────────────────────────────────────────────────
exports.getWeek = async (req, res) => {
  try {
    const ws = weekStart(req.query.week);
    const we = addDays(ws, 6);
    const [staff, shifts, timeOff, removals, locations, pendingTimeOff] = await Promise.all([
      pool.query(`SELECT id, name, role, (phone IS NOT NULL AND phone <> '') AS has_phone
                    FROM staff_members WHERE is_active = TRUE ORDER BY role, name`),
      pool.query(
        `SELECT s.id, s.staff_id, s.location_id, to_char(s.shift_date, 'YYYY-MM-DD') AS date,
                to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
                s.note, l.title AS location, ${SHIFT_HOURS()}::float AS hours,
                (s.notified_at IS NULL OR s.updated_at > s.notified_at) AS unsent
           FROM staff_shifts s LEFT JOIN locations l ON l.id = s.location_id
          WHERE s.shift_date BETWEEN $1 AND $2
          ORDER BY s.shift_date, s.start_time`, [ws, we]),
      pool.query(
        `SELECT id, staff_id, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, status, reason
           FROM time_off_requests
          WHERE status IN ('pending', 'approved') AND start_date <= $2 AND end_date >= $1`, [ws, we]),
      pool.query(
        `SELECT staff_id, count(*)::int AS n FROM staff_shift_removals
          WHERE notified_at IS NULL AND shift_date BETWEEN $1 AND $2 GROUP BY staff_id`, [ws, we]),
      pool.query(`SELECT id, title FROM locations WHERE is_active = TRUE ORDER BY id`),
      pool.query(`SELECT count(*)::int AS n FROM time_off_requests WHERE status = 'pending'`),
    ]);
    const toSend = new Set([
      ...shifts.rows.filter(s => s.unsent).map(s => s.staff_id),
      ...removals.rows.map(r => r.staff_id),
    ]);
    res.json({
      week_start: ws,
      days: Array.from({ length: 7 }, (_, i) => addDays(ws, i)),
      today: todayNY(),
      staff: staff.rows,
      shifts: shifts.rows,
      time_off: timeOff.rows,
      locations: locations.rows,
      people_with_changes: [...toSend],
      pending_time_off: pendingTimeOff.rows[0].n,
    });
  } catch (e) { send(res, e); }
};

async function validateShift(body, excludeId = null) {
  const staffId = parseInt(body?.staff_id, 10);
  const { shift_date, start_time, end_time } = body || {};
  const locationId = body?.location_id ? parseInt(body.location_id, 10) : null;
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : null;
  if (!staffId) throw err(400, 'Choose a staff member.');
  if (!DAY_RE.test(shift_date || '')) throw err(400, 'Choose a date.');
  if (!TIME_RE.test(start_time || '') || !TIME_RE.test(end_time || '')) throw err(400, 'Enter start and end times.');
  if (start_time === end_time) throw err(400, 'Start and end time are the same.');

  const who = await pool.query('SELECT name FROM staff_members WHERE id = $1 AND is_active = TRUE', [staffId]);
  if (!who.rows.length) throw err(400, 'That staff member is not active.');
  if (locationId) {
    const loc = await pool.query('SELECT 1 FROM locations WHERE id = $1', [locationId]);
    if (!loc.rows.length) throw err(400, 'Unknown store.');
  }
  // No double-booking the same person (overnight shifts included).
  const overlap = await pool.query(
    `WITH n AS (SELECT $2::date AS shift_date, $3::time AS start_time, $4::time AS end_time)
     SELECT 1 FROM staff_shifts s, n
      WHERE s.staff_id = $1 AND ($5::int IS NULL OR s.id <> $5)
        AND s.shift_date BETWEEN n.shift_date - 1 AND n.shift_date + 1
        AND ${SHIFT_START('s')} < ${SHIFT_END('n')} AND ${SHIFT_END('s')} > ${SHIFT_START('n')}
      LIMIT 1`,
    [staffId, shift_date, start_time, end_time, excludeId]);
  if (overlap.rows.length) throw err(409, `${who.rows[0].name} already has a shift at that time.`);
  if (!body.force) {
    const off = await pool.query(
      `SELECT 1 FROM time_off_requests WHERE staff_id = $1 AND status = 'approved' AND $2::date BETWEEN start_date AND end_date LIMIT 1`,
      [staffId, shift_date]);
    if (off.rows.length) throw err(409, `${who.rows[0].name} has approved time off that day.`, { code: 'time_off' });
  }
  return { staffId, shift_date, start_time, end_time, locationId, note };
}

exports.createShift = async (req, res) => {
  try {
    const v = await validateShift(req.body);
    const r = await pool.query(
      `INSERT INTO staff_shifts (staff_id, location_id, shift_date, start_time, end_time, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [v.staffId, v.locationId, v.shift_date, v.start_time, v.end_time, v.note]);
    res.status(201).json(r.rows[0]);
  } catch (e) { send(res, e); }
};

exports.updateShift = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cur = await pool.query(
      `SELECT staff_id, to_char(shift_date, 'YYYY-MM-DD') AS shift_date, notified_at FROM staff_shifts WHERE id = $1`, [id]);
    if (!cur.rows.length) throw err(404, 'Shift not found.');
    const v = await validateShift({ ...req.body, staff_id: req.body.staff_id || cur.rows[0].staff_id }, id);
    // Moved to someone else / another week after being texted: the original
    // person gets told it's gone.
    const old = cur.rows[0];
    if (old.notified_at && (old.staff_id !== v.staffId || weekStart(old.shift_date) !== weekStart(v.shift_date))) {
      await pool.query('INSERT INTO staff_shift_removals (staff_id, shift_date) VALUES ($1, $2)', [old.staff_id, old.shift_date]);
    }
    await pool.query(
      `UPDATE staff_shifts SET staff_id=$1, location_id=$2, shift_date=$3, start_time=$4, end_time=$5, note=$6, updated_at=NOW()
        WHERE id=$7`,
      [v.staffId, v.locationId, v.shift_date, v.start_time, v.end_time, v.note, id]);
    res.json({ success: true });
  } catch (e) { send(res, e); }
};

exports.deleteShift = async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM staff_shifts WHERE id = $1 RETURNING staff_id, to_char(shift_date, 'YYYY-MM-DD') AS shift_date, notified_at`,
      [parseInt(req.params.id, 10)]);
    if (!r.rows.length) throw err(404, 'Shift not found.');
    if (r.rows[0].notified_at) {
      await pool.query('INSERT INTO staff_shift_removals (staff_id, shift_date) VALUES ($1, $2)', [r.rows[0].staff_id, r.rows[0].shift_date]);
    }
    res.json({ success: true });
  } catch (e) { send(res, e); }
};

// Copies one week's shifts into another, skipping any that already exist and
// anyone no longer active.
exports.copyWeek = async (req, res) => {
  try {
    const from = weekStart(req.body?.from);
    const to = weekStart(req.body?.to);
    if (from === to) throw err(400, 'Choose a different week to copy into.');
    const r = await pool.query(
      `INSERT INTO staff_shifts (staff_id, location_id, shift_date, start_time, end_time, note)
       SELECT s.staff_id, s.location_id, s.shift_date + ($2::date - $1::date), s.start_time, s.end_time, s.note
         FROM staff_shifts s JOIN staff_members m ON m.id = s.staff_id AND m.is_active
        WHERE s.shift_date BETWEEN $1::date AND $1::date + 6
          AND NOT EXISTS (
            SELECT 1 FROM staff_shifts t
             WHERE t.staff_id = s.staff_id AND t.shift_date = s.shift_date + ($2::date - $1::date)
               AND t.start_time = s.start_time)
       RETURNING id`, [from, to]);
    res.json({ copied: r.rowCount });
  } catch (e) { send(res, e); }
};

// Texts everyone whose shifts in the week changed since they were last told:
// their whole week as it now stands. Skips people with no phone or who texted
// STOP; nothing is marked sent unless the text actually went.
exports.notifyWeek = async (req, res) => {
  try {
    const ws = weekStart(req.body?.week);
    const we = addDays(ws, 6);
    const people = await pool.query(
      `SELECT m.id, m.name, m.phone, m.role FROM staff_members m
        WHERE m.is_active AND (
          EXISTS (SELECT 1 FROM staff_shifts s WHERE s.staff_id = m.id AND s.shift_date BETWEEN $1 AND $2
                    AND (s.notified_at IS NULL OR s.updated_at > s.notified_at))
          OR EXISTS (SELECT 1 FROM staff_shift_removals r WHERE r.staff_id = m.id AND r.notified_at IS NULL
                    AND r.shift_date BETWEEN $1 AND $2))`, [ws, we]);
    const app = (process.env.FRONTEND_URL || 'https://habibihe.com').replace(/\/$/, '');
    const range = `${fmtDay(ws)}–${fmtDay(we)}`;
    const sent = []; const skipped = [];

    for (const p of people.rows) {
      if (!p.phone) { skipped.push({ name: p.name, reason: 'no phone number' }); continue; }
      const digits = toE164(p.phone).replace(/\D/g, '');
      const out = await pool.query(`SELECT 1 FROM sms_optouts WHERE RIGHT(phone_digits, 10) = RIGHT($1, 10)`, [digits]);
      if (out.rows.length) { skipped.push({ name: p.name, reason: 'opted out of texts (STOP)' }); continue; }

      const shifts = await pool.query(
        `SELECT to_char(s.shift_date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS start_time,
                to_char(s.end_time, 'HH24:MI') AS end_time, l.title AS location
           FROM staff_shifts s LEFT JOIN locations l ON l.id = s.location_id
          WHERE s.staff_id = $1 AND s.shift_date BETWEEN $2 AND $3 ORDER BY s.shift_date, s.start_time`, [p.id, ws, we]);
      const lines = shifts.rows.map(s => `${fmtDay(s.date)} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}${s.location ? ` (${s.location})` : ''}`);
      const where = `${app}/${p.role === 'delivery' ? 'driver' : 'staff'}`;
      const body = lines.length
        ? `${p.name.split(' ')[0]}, your shifts for ${range}:\n${lines.join('\n')}\nSee them anytime: ${where}`
        : `${p.name.split(' ')[0]}, you have no shifts for ${range} (your earlier shifts were removed). ${where}`;

      const r = await sendSMS(p.phone, body);
      if (!r.success) { skipped.push({ name: p.name, reason: `text failed: ${r.error || 'unknown error'}` }); continue; }
      await pool.query(`UPDATE staff_shifts SET notified_at = NOW() WHERE staff_id = $1 AND shift_date BETWEEN $2 AND $3`, [p.id, ws, we]);
      await pool.query(`UPDATE staff_shift_removals SET notified_at = NOW() WHERE staff_id = $1 AND shift_date BETWEEN $2 AND $3 AND notified_at IS NULL`, [p.id, ws, we]);
      sent.push({ name: p.name });
    }
    logAudit(pool, req.user?.id, req.user?.name, 'text_schedule', 'schedule', ws, { sent: sent.length, skipped: skipped.length }, req.ip);
    res.json({ week_start: ws, sent, skipped });
  } catch (e) { send(res, e); }
};

// ── CPanel: hours ─────────────────────────────────────────────────────────────
exports.getHours = async (req, res) => {
  try {
    const ws = weekStart(req.query.week);
    const we = addDays(ws, 6);
    const [staff, scheduled, entries] = await Promise.all([
      pool.query(`SELECT id, name, role FROM staff_members WHERE is_active = TRUE ORDER BY role, name`),
      pool.query(`SELECT s.staff_id, sum(${SHIFT_HOURS()})::float AS hours, count(*)::int AS shifts
                    FROM staff_shifts s WHERE s.shift_date BETWEEN $1 AND $2 GROUP BY s.staff_id`, [ws, we]),
      pool.query(
        `SELECT t.id, t.staff_id, t.clock_in, t.clock_out, t.source, t.note, t.edited_by,
                (s.id IS NOT NULL AND t.clock_in > ${SHIFT_START()} + INTERVAL '${LATE_GRACE_MIN} minutes') AS late,
                CASE WHEN s.id IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (t.clock_in - ${SHIFT_START()})) / 60) END::int AS minutes_late,
                (t.clock_out IS NULL AND t.clock_in < NOW() - INTERVAL '${MISSING_CLOCK_OUT_HOURS} hours') AS missing_out,
                EXTRACT(EPOCH FROM (COALESCE(t.clock_out, NOW()) - t.clock_in))::float / 3600 AS hours
           FROM time_clock t LEFT JOIN staff_shifts s ON s.id = t.shift_id
          WHERE (t.clock_in AT TIME ZONE '${TZ}')::date BETWEEN $1 AND $2
          ORDER BY t.clock_in`, [ws, we]),
    ]);
    const sched = new Map(scheduled.rows.map(r => [r.staff_id, r]));
    const people = staff.rows.map(p => {
      const mine = entries.rows.filter(e => e.staff_id === p.id);
      return {
        ...p,
        scheduled_hours: sched.get(p.id)?.hours || 0,
        shifts: sched.get(p.id)?.shifts || 0,
        worked_hours: mine.filter(e => e.clock_out).reduce((s, e) => s + e.hours, 0),
        on_clock: mine.some(e => !e.clock_out && !e.missing_out),
        late: mine.filter(e => e.late).length,
        missing_out: mine.filter(e => e.missing_out).length,
        entries: mine,
      };
    }).filter(p => p.shifts || p.entries.length);
    res.json({ week_start: ws, days: Array.from({ length: 7 }, (_, i) => addDays(ws, i)), people, late_grace_minutes: LATE_GRACE_MIN });
  } catch (e) { send(res, e); }
};

// Clock entries typed in CPanel are New York time ("YYYY-MM-DDTHH:MM").
const LOCAL_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function checkTimes(clockIn, clockOut) {
  if (!LOCAL_TS_RE.test(clockIn || '')) throw err(400, 'Enter the clock-in time.');
  if (clockOut && !LOCAL_TS_RE.test(clockOut)) throw err(400, 'The clock-out time is not valid.');
  if (clockOut && clockOut <= clockIn) throw err(400, 'Clock-out must be after clock-in.');
}

exports.addClockEntry = async (req, res) => {
  try {
    const staffId = parseInt(req.body?.staff_id, 10);
    const { clock_in, clock_out } = req.body || {};
    checkTimes(clock_in, clock_out);
    if (!clock_out) throw err(400, 'Enter the clock-out time too.');
    const r = await pool.query(
      `INSERT INTO time_clock (staff_id, clock_in, clock_out, source, note, edited_by)
       VALUES ($1, ($2::timestamp AT TIME ZONE '${TZ}'), ($3::timestamp AT TIME ZONE '${TZ}'), 'admin', $4, $5) RETURNING id`,
      [staffId, clock_in, clock_out, (req.body.note || '').slice(0, 200) || null, req.user?.name || 'Admin']);
    logAudit(pool, req.user?.id, req.user?.name, 'add_clock_entry', 'time_clock', String(r.rows[0].id), { staff_id: staffId, clock_in, clock_out }, req.ip);
    res.status(201).json(r.rows[0]);
  } catch (e) { send(res, e); }
};

exports.updateClockEntry = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { clock_in, clock_out } = req.body || {};
    checkTimes(clock_in, clock_out);
    const r = await pool.query(
      `UPDATE time_clock SET clock_in = ($1::timestamp AT TIME ZONE '${TZ}'),
              clock_out = CASE WHEN $2::text IS NULL THEN NULL ELSE ($2::timestamp AT TIME ZONE '${TZ}') END,
              note = COALESCE($3, note), edited_by = $4
        WHERE id = $5 RETURNING id`,
      [clock_in, clock_out || null, req.body.note ? String(req.body.note).slice(0, 200) : null, req.user?.name || 'Admin', id]);
    if (!r.rows.length) throw err(404, 'Entry not found.');
    logAudit(pool, req.user?.id, req.user?.name, 'edit_clock_entry', 'time_clock', String(id), { clock_in, clock_out }, req.ip);
    res.json({ success: true });
  } catch (e) {
    if (e.code === '23505') return send(res, err(409, 'That person already has an open clock-in.'));
    send(res, e);
  }
};

exports.deleteClockEntry = async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM time_clock WHERE id = $1 RETURNING staff_id, clock_in, clock_out', [parseInt(req.params.id, 10)]);
    if (!r.rows.length) throw err(404, 'Entry not found.');
    logAudit(pool, req.user?.id, req.user?.name, 'delete_clock_entry', 'time_clock', req.params.id, r.rows[0], req.ip);
    res.json({ success: true });
  } catch (e) { send(res, e); }
};

// ── CPanel: time off ──────────────────────────────────────────────────────────
exports.listTimeOff = async (req, res) => {
  try {
    const pendingOnly = req.query.status === 'pending';
    const r = await pool.query(
      `SELECT t.id, t.staff_id, m.name, m.role, to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(t.end_date, 'YYYY-MM-DD') AS end_date, t.reason, t.status, t.decided_by, t.decided_at,
              t.decision_note, t.created_at,
              (SELECT count(*)::int FROM staff_shifts s WHERE s.staff_id = t.staff_id
                  AND s.shift_date BETWEEN t.start_date AND t.end_date) AS shifts_affected
         FROM time_off_requests t JOIN staff_members m ON m.id = t.staff_id
        WHERE ${pendingOnly ? "t.status = 'pending'" : `t.end_date >= ${NY_TODAY} - 60`}
        ORDER BY (t.status = 'pending') DESC, t.start_date ASC LIMIT 200`);
    res.json(r.rows);
  } catch (e) { send(res, e); }
};

exports.decideTimeOff = async (req, res) => {
  try {
    const status = req.body?.status;
    if (!['approved', 'declined'].includes(status)) throw err(400, 'Approve or decline.');
    const r = await pool.query(
      `UPDATE time_off_requests SET status = $1, decided_by = $2, decided_at = NOW(), decision_note = $3
        WHERE id = $4 AND status = 'pending' RETURNING id`,
      [status, req.user?.name || 'Admin', req.body.note ? String(req.body.note).slice(0, 300) : null, parseInt(req.params.id, 10)]);
    if (!r.rows.length) throw err(409, 'This request was already decided or cancelled.');
    logAudit(pool, req.user?.id, req.user?.name, `time_off_${status}`, 'time_off', req.params.id, {}, req.ip);
    res.json({ success: true });
  } catch (e) { send(res, e); }
};
