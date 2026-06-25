const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

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

  const now  = new Date();
  const day  = now.getDay();
  const hhmm = now.getHours() * 60 + now.getMinutes();

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
