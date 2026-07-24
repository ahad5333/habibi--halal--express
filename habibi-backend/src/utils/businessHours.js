const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// This server's Node process runs in UTC, not America/New_York — using
// Date.prototype.getDay()/getHours() directly (as this file used to) computes
// the wrong day-of-week and time-of-day for a NYC restaurant, off by the
// UTC/Eastern offset (4-5hrs depending on DST). At 11:30 PM Thursday Eastern,
// for example, getDay()/getHours() would report "Friday 9:00 AM" — potentially
// showing the site as open when it's actually closed for the night, or vice
// versa. Same class of bug already fixed elsewhere in this project (Reports'
// dateRange, etc.) — always compute wall-clock day/time via Intl with an
// explicit timeZone, never via the Date object's own local getters.
function nowInEastern() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0; // defensive — some ICU builds format midnight as "24"
  return { day: DAY_MAP[map.weekday.toLowerCase()], hhmm: hour * 60 + parseInt(map.minute, 10) };
}

function parseTime(s) {
  s = s.trim().toLowerCase().replace(/\s/g, '');
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (!m) return null;
  let hr = parseInt(m[1], 10);
  const min = parseInt(m[2] || '0', 10);
  if (m[3] === 'pm' && hr !== 12) hr += 12;
  if (m[3] === 'am' && hr === 12) hr = 0;
  return hr * 60 + min;
}

function parseDayRange(s) {
  s = s.trim().toLowerCase();
  const parts = s.split(/[–\-]/);
  const a = DAY_MAP[parts[0]?.trim().slice(0, 3)];
  const b = parts[1] ? DAY_MAP[parts[1]?.trim().slice(0, 3)] : a;
  if (a == null) return [];
  const days = [];
  if (b == null || b >= a) {
    for (let i = a; i <= (b ?? a); i++) days.push(i);
  } else {
    for (let i = a; i <= 6; i++) days.push(i);
    for (let i = 0; i <= b; i++) days.push(i);
  }
  return days;
}

// Returns true (open), false (closed), or null (can't determine from string)
function isOpenNow(hoursStr) {
  if (!hoursStr) return null;
  const h = hoursStr.toLowerCase();
  if (h.includes('24 hour') || h.includes('24hours') || h.includes('always')) return true;

  const { day, hhmm } = nowInEastern();

  const segments = hoursStr.split(/[·,;]+/);
  for (const seg of segments) {
    const colon = seg.indexOf(':');
    if (colon === -1) continue;
    const dayPart  = seg.slice(0, colon).trim();
    const timePart = seg.slice(colon + 1).trim();
    const openDays = parseDayRange(dayPart);
    if (!openDays.includes(day)) continue;
    const times = timePart.split(/[–\-]/);
    if (times.length < 2) continue;
    const open  = parseTime(times[0]);
    const close = parseTime(times[1]);
    if (open == null || close == null) continue;
    if (close > open) return hhmm >= open && hhmm < close;
    if (close < open) return hhmm >= open || hhmm < close;
  }
  return null;
}

module.exports = { isOpenNow };
