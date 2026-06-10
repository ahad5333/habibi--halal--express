const TZ = 'America/New_York';

export function fmtDate(ts, opts = {}) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, ...opts });
}

export function fmtTime(ts, opts = {}) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', ...opts });
}

export function fmtDateTime(ts, opts = {}) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', ...opts });
}

export function fmtDateShort(ts) {
  return fmtDate(ts, { month: 'short', day: 'numeric', year: 'numeric' });
}
