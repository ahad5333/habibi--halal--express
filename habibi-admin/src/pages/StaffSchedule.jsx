import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Plus, X, Send, Copy, Download, Check } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Reports.css';
import './StaffSchedule.css';

// Staff Schedule: plan the week's shifts, text people their week, see hours
// worked (clock in/out from the staff and driver apps), and handle time-off
// requests. Everything is New York time.

const TZ = 'America/New_York';
const ROLE = { kitchen: 'Kitchen', manager: 'Manager', cashier: 'Cashier', server: 'Server', delivery: 'Driver' };

const addDays = (ymd, n) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayHead = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const dateLong = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const shortTime = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`;
};
const nyTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
const nyDate = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: TZ });
const hrs = (n) => `${(Math.round((n || 0) * 10) / 10).toLocaleString()}h`;
// timestamptz -> "YYYY-MM-DDTHH:MM" in New York, for datetime-local inputs
function nyInput(iso) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const g = (t) => p.find(x => x.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}

// ── Week navigation (shared by Planner and Hours) ────────────────────────────
function WeekNav({ weekStart, onChange }) {
  if (!weekStart) return null;
  const end = addDays(weekStart, 6);
  return (
    <div className="ss-weeknav">
      <button className="btn btn-sm btn-secondary" onClick={() => onChange(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeft size={14} /></button>
      <strong>{dateLong(weekStart)} – {dateLong(end)}</strong>
      <button className="btn btn-sm btn-secondary" onClick={() => onChange(addDays(weekStart, 7))} aria-label="Next week"><ChevronRight size={14} /></button>
      <button className="btn btn-sm btn-ghost" onClick={() => onChange('')}>This week</button>
    </div>
  );
}

// ── Shift editor ─────────────────────────────────────────────────────────────
function ShiftModal({ initial, staff, locations, onClose, onSaved }) {
  const editing = !!initial.id;
  const [f, setF] = useState({
    staff_id: String(initial.staff_id || ''), shift_date: initial.date || '', start_time: initial.start_time || '09:00',
    end_time: initial.end_time || '17:00', location_id: initial.location_id ? String(initial.location_id) : (locations[0] ? String(locations[0].id) : ''),
    note: initial.note || '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const overnight = f.start_time && f.end_time && f.end_time <= f.start_time;

  const save = async (e, force = false) => {
    e?.preventDefault();
    setErr(''); setBusy(true);
    const body = { ...f, staff_id: parseInt(f.staff_id, 10), location_id: f.location_id || null, force };
    try {
      if (editing) await adminAPI.updateShift(initial.id, body);
      else await adminAPI.createShift(body);
      onSaved(f);
    } catch (e2) {
      if (e2.data?.code === 'time_off' && window.confirm(`${e2.message} Schedule them anyway?`)) return save(null, true);
      setErr(e2.message);
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this shift? If the person was already texted, they\'ll be told it was removed next time you text the schedule.')) return;
    try { await adminAPI.deleteShift(initial.id); onSaved(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h3 className="modal-title">{editing ? 'Edit shift' : 'Add shift'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="field">
              <label>Staff member</label>
              <select className="input select" value={f.staff_id} onChange={set('staff_id')} required>
                <option value="">Choose…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} · {ROLE[s.role] || s.role}</option>)}
              </select>
            </div>
            <div className="ss-form-row3">
              <div className="field"><label>Date</label><input className="input" type="date" value={f.shift_date} onChange={set('shift_date')} required /></div>
              <div className="field"><label>Start</label><input className="input" type="time" value={f.start_time} onChange={set('start_time')} required /></div>
              <div className="field"><label>End</label><input className="input" type="time" value={f.end_time} onChange={set('end_time')} required /></div>
            </div>
            {overnight && <p className="ss-hint">Ends the next day (overnight shift).</p>}
            <div className="ss-form-row2">
              <div className="field">
                <label>Store</label>
                <select className="input select" value={f.location_id} onChange={set('location_id')}>
                  <option value="">Not specified</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div className="field"><label>Note</label><input className="input" maxLength={200} value={f.note} onChange={set('note')} placeholder="Optional, e.g. opening" /></div>
            </div>
            {err && <div className="ss-err">⚠ {err}</div>}
          </div>
          <div className="modal-footer">
            {editing && <button type="button" className="btn btn-ghost ss-danger" onClick={remove}>Delete</button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save shift'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Planner ──────────────────────────────────────────────────────────────────
function Planner({ week, setWeek, onWeekLoaded }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [lastTimes, setLastTimes] = useState({ start_time: '09:00', end_time: '17:00' });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const d = await adminAPI.scheduleWeek(week); setData(d); onWeekLoaded(d); setError(''); }
    catch (e) { setError(e.message); }
  }, [week]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const byCell = useMemo(() => {
    const m = new Map();
    (data?.shifts || []).forEach(s => { const k = `${s.staff_id}|${s.date}`; m.set(k, [...(m.get(k) || []), s]); });
    return m;
  }, [data]);
  const offOn = (staffId, day) => (data?.time_off || []).find(t => t.staff_id === staffId && t.start_date <= day && t.end_date >= day);
  const staffHours = (id) => (data?.shifts || []).filter(s => s.staff_id === id).reduce((a, s) => a + s.hours, 0);

  const copyLastWeek = async () => {
    if (!window.confirm('Copy last week\'s shifts into this week? Shifts that already exist are skipped.')) return;
    setBusy(true);
    try { const r = await adminAPI.copyScheduleWeek(addDays(data.week_start, -7), data.week_start); setNotice({ ok: true, text: `Copied ${r.copied} shift${r.copied === 1 ? '' : 's'} from last week.` }); load(); }
    catch (e) { setNotice({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  const textSchedule = async () => {
    const n = data.people_with_changes.length;
    if (!window.confirm(`Text ${n} ${n === 1 ? 'person' : 'people'} their schedule for this week? Each text costs about 1¢.`)) return;
    setBusy(true);
    try {
      const r = await adminAPI.textSchedule(data.week_start);
      const parts = [];
      if (r.sent.length) parts.push(`Texted ${r.sent.map(x => x.name).join(', ')}.`);
      if (r.skipped.length) parts.push(`Not texted: ${r.skipped.map(x => `${x.name} (${x.reason})`).join('; ')}.`);
      setNotice({ ok: r.skipped.length === 0, text: parts.join(' ') || 'Nothing to send.' });
      load();
    } catch (e) { setNotice({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  if (error) return <div className="card ss-err">{error}</div>;
  if (!data) return <div className="card"><div className="empty" style={{ minHeight: 200 }}><div className="spinner" /></div></div>;

  const changes = data.people_with_changes.length;
  return (
    <>
      <div className="ss-toolbar">
        <WeekNav weekStart={data.week_start} onChange={setWeek} />
        <div className="ss-actions">
          <button className="btn btn-sm btn-secondary" onClick={copyLastWeek} disabled={busy}><Copy size={13} /> Copy last week</button>
          <button className="btn btn-sm btn-primary" onClick={textSchedule} disabled={busy || changes === 0}
                  title={changes ? '' : 'Everyone already has the latest version of this week'}>
            <Send size={13} /> {changes ? `Text schedule (${changes})` : 'Schedule sent'}
          </button>
        </div>
      </div>
      {notice && <div className={`ss-notice ${notice.ok ? 'ok' : 'warn'}`}>{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={13} /></button></div>}

      {data.staff.length === 0 ? (
        <div className="card"><div className="empty" style={{ minHeight: 180 }}><CalendarClock size={32} /><p>No active staff yet — add them on the Staff page first.</p></div></div>
      ) : (
        <div className="card ss-grid-card">
          <div className="table-wrap">
            <table className="ss-grid">
              <thead>
                <tr>
                  <th className="ss-person-col">Staff</th>
                  {data.days.map(d => <th key={d} className={d === data.today ? 'is-today' : ''}>{dayHead(d)}</th>)}
                  <th className="ss-total-col">Hours</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map(p => (
                  <tr key={p.id}>
                    <td className="ss-person-col">
                      <div className="ss-person">{p.name}</div>
                      <div className="ss-role">{ROLE[p.role] || p.role}{!p.has_phone && <span title="No phone number — can't be texted"> · no phone</span>}</div>
                    </td>
                    {data.days.map(d => {
                      const off = offOn(p.id, d);
                      return (
                        <td key={d} className={`ss-cell${d === data.today ? ' is-today' : ''}`}>
                          {off && <span className={`ss-off ${off.status}`} title={off.reason || ''}>{off.status === 'approved' ? 'Off' : 'Off?'}</span>}
                          {(byCell.get(`${p.id}|${d}`) || []).map(s => (
                            <button key={s.id} className="ss-chip" onClick={() => setEditing(s)} title={`${s.location || ''}${s.note ? ` · ${s.note}` : ''}`}>
                              {shortTime(s.start_time)}–{shortTime(s.end_time)}
                              {s.unsent && <span className="ss-dot" title="Changed since last text" />}
                            </button>
                          ))}
                          <button className="ss-add" onClick={() => setEditing({ staff_id: p.id, date: d, ...lastTimes })} aria-label={`Add shift for ${p.name} on ${dayHead(d)}`}><Plus size={12} /></button>
                        </td>
                      );
                    })}
                    <td className="ss-total-col">{hrs(staffHours(p.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ss-legend"><span className="ss-dot" /> changed since the last text · <span className="ss-off approved">Off</span> approved time off · <span className="ss-off pending">Off?</span> requested</p>
        </div>
      )}

      {editing && (
        <ShiftModal
          initial={editing}
          staff={data.staff}
          locations={data.locations}
          onClose={() => setEditing(null)}
          onSaved={(saved) => { if (saved) setLastTimes({ start_time: saved.start_time, end_time: saved.end_time }); setEditing(null); load(); }}
        />
      )}
    </>
  );
}

// ── Hours ────────────────────────────────────────────────────────────────────
function ClockModal({ entry, staff, onClose, onSaved }) {
  const editing = !!entry.id;
  const [f, setF] = useState({
    staff_id: String(entry.staff_id || ''),
    clock_in: entry.clock_in ? nyInput(entry.clock_in) : '',
    clock_out: entry.clock_out ? nyInput(entry.clock_out) : '',
    note: entry.note || '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const body = { ...f, staff_id: parseInt(f.staff_id, 10), clock_out: f.clock_out || null };
      if (editing) await adminAPI.updateClockEntry(entry.id, body); else await adminAPI.addClockEntry(body);
      onSaved();
    } catch (e2) { setErr(e2.message); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this clock entry?')) return;
    try { await adminAPI.deleteClockEntry(entry.id); onSaved(); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h3 className="modal-title">{editing ? 'Fix clock entry' : 'Add clock entry'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {!editing && (
              <div className="field">
                <label>Staff member</label>
                <select className="input select" value={f.staff_id} onChange={set('staff_id')} required>
                  <option value="">Choose…</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="ss-form-row2">
              <div className="field"><label>Clock in</label><input className="input" type="datetime-local" value={f.clock_in} onChange={set('clock_in')} required /></div>
              <div className="field"><label>Clock out</label><input className="input" type="datetime-local" value={f.clock_out} onChange={set('clock_out')} required={!editing} /></div>
            </div>
            <div className="field"><label>Note</label><input className="input" maxLength={200} value={f.note} onChange={set('note')} placeholder="Why it was changed (optional)" /></div>
            <p className="ss-hint">New York time.</p>
            {err && <div className="ss-err">⚠ {err}</div>}
          </div>
          <div className="modal-footer">
            {editing && <button type="button" className="btn btn-ghost ss-danger" onClick={remove}>Delete</button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const SOURCE = { app: 'Staff app', driver_duty: 'Driver on duty', admin: 'CPanel' };

function Hours({ week, setWeek, allStaff }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try { setData(await adminAPI.scheduleHours(week)); setError(''); } catch (e) { setError(e.message); }
  }, [week]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const rows = [['Name', 'Role', 'Scheduled hours', 'Worked hours', 'Late arrivals', 'Missing clock-outs']];
    data.people.forEach(p => rows.push([p.name, ROLE[p.role] || p.role, p.scheduled_hours.toFixed(2), p.worked_hours.toFixed(2), p.late, p.missing_out]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `hours-${data.week_start}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <div className="card ss-err">{error}</div>;
  if (!data) return <div className="card"><div className="empty" style={{ minHeight: 200 }}><div className="spinner" /></div></div>;

  return (
    <>
      <div className="ss-toolbar">
        <WeekNav weekStart={data.week_start} onChange={setWeek} />
        <div className="ss-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => setEditing({})}><Plus size={13} /> Add entry</button>
          <button className="btn btn-sm btn-secondary" onClick={exportCsv} disabled={!data.people.length}><Download size={13} /> Export CSV</button>
        </div>
      </div>
      {data.people.length === 0 ? (
        <div className="card"><div className="empty" style={{ minHeight: 180 }}><CalendarClock size={32} />
          <p style={{ maxWidth: 440 }}>No shifts or clock-ins this week. Staff clock in from the <strong>Schedule</strong> button on their order screen; drivers clock in by going on duty.</p>
        </div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table ss-hours">
              <thead><tr><th>Staff</th><th style={{ textAlign: 'right' }}>Scheduled</th><th style={{ textAlign: 'right' }}>Worked</th><th style={{ textAlign: 'right' }}>Difference</th><th>Flags</th><th /></tr></thead>
              <tbody>
                {data.people.map(p => {
                  const diff = p.worked_hours - p.scheduled_hours;
                  return (
                    <React.Fragment key={p.id}>
                      <tr>
                        <td><div style={{ fontWeight: 600 }}>{p.name}</div><div className="text-muted" style={{ fontSize: '0.72rem' }}>{ROLE[p.role] || p.role}</div></td>
                        <td style={{ textAlign: 'right' }}>{hrs(p.scheduled_hours)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{hrs(p.worked_hours)}</td>
                        <td style={{ textAlign: 'right', color: diff < -0.25 ? '#b45309' : undefined }}>{p.scheduled_hours ? `${diff >= 0 ? '+' : ''}${hrs(diff)}` : '—'}</td>
                        <td>
                          <div className="ss-flags">
                            {p.on_clock && <span className="badge badge-success">On the clock</span>}
                            {p.late > 0 && <span className="badge badge-warning">{p.late} late</span>}
                            {p.missing_out > 0 && <span className="badge badge-error">{p.missing_out} missing clock-out</span>}
                          </div>
                        </td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide' : `${p.entries.length} ${p.entries.length === 1 ? 'entry' : 'entries'}`}</button></td>
                      </tr>
                      {open === p.id && (
                        <tr className="ss-entries-row"><td colSpan={6}>
                          {p.entries.length === 0 ? <p className="text-muted">No clock-ins this week.</p> : (
                            <ul className="ss-entries">
                              {p.entries.map(e => (
                                <li key={e.id}>
                                  <span className="ss-entry-day">{nyDate(e.clock_in)}</span>
                                  <span>{nyTime(e.clock_in)} – {e.clock_out ? nyTime(e.clock_out) : (e.missing_out ? <b className="ss-warn-text">no clock-out</b> : 'still clocked in')}</span>
                                  <span className="text-muted">{e.clock_out ? hrs(e.hours) : ''}</span>
                                  {e.late && <span className="badge badge-warning">{e.minutes_late} min late</span>}
                                  <span className="text-muted ss-src">{SOURCE[e.source] || e.source}{e.edited_by ? ` · edited by ${e.edited_by}` : ''}</span>
                                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(e)}>Fix</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ss-legend">Late = clocked in more than {data.late_grace_minutes} minutes after the shift started. Worked hours count completed clock-ins only.</p>
        </div>
      )}
      {editing && <ClockModal entry={editing} staff={allStaff} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

// ── Time off ─────────────────────────────────────────────────────────────────
function TimeOff({ onChanged }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setList(await adminAPI.timeOffRequests()); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (r, status) => {
    const note = status === 'declined' ? window.prompt('Reason for declining (optional, the person will see it):') : '';
    if (note === null) return;
    try { await adminAPI.decideTimeOff(r.id, status, note || undefined); load(); onChanged(); } catch (e) { alert(e.message); }
  };

  if (error) return <div className="card ss-err">{error}</div>;
  if (!list) return <div className="card"><div className="empty" style={{ minHeight: 200 }}><div className="spinner" /></div></div>;
  const pending = list.filter(r => r.status === 'pending');
  const decided = list.filter(r => r.status !== 'pending');
  const days = (r) => Math.round((new Date(`${r.end_date}T12:00:00Z`) - new Date(`${r.start_date}T12:00:00Z`)) / 864e5) + 1;
  const range = (r) => `${dateLong(r.start_date)}${r.end_date !== r.start_date ? ` – ${dateLong(r.end_date)}` : ''}`;

  return (
    <>
      <div className="card ss-section">
        <p className="ss-title">Waiting for a decision</p>
        {pending.length === 0 ? <p className="text-muted">No requests waiting.</p> : (
          <ul className="ss-requests">
            {pending.map(r => (
              <li key={r.id}>
                <div className="ss-req-main">
                  <strong>{r.name}</strong> <span className="text-muted">· {ROLE[r.role] || r.role}</span>
                  <div>{range(r)} <span className="text-muted">({days(r)} day{days(r) === 1 ? '' : 's'})</span></div>
                  {r.reason && <div className="text-muted">“{r.reason}”</div>}
                  {r.shifts_affected > 0 && <div className="ss-warn-text">Has {r.shifts_affected} shift{r.shifts_affected === 1 ? '' : 's'} scheduled in those days</div>}
                </div>
                <div className="ss-req-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => decide(r, 'declined')}>Decline</button>
                  <button className="btn btn-sm btn-primary" onClick={() => decide(r, 'approved')}><Check size={13} /> Approve</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card ss-section">
        <p className="ss-title">Decided (last 60 days)</p>
        {decided.length === 0 ? <p className="text-muted">Nothing yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Staff</th><th>Dates</th><th>Status</th><th>Decided by</th><th>Note</th></tr></thead>
              <tbody>
                {decided.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{range(r)}</td>
                    <td><span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'declined' ? 'badge-error' : 'badge-muted'}`}>{r.status}</span></td>
                    <td className="text-muted">{r.decided_by || '—'}</td>
                    <td className="text-muted">{r.decision_note || r.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function StaffSchedule() {
  const [tab, setTab] = useState('planner');
  const [week, setWeek] = useState('');
  const [staff, setStaff] = useState([]);
  const [pendingOff, setPendingOff] = useState(0);

  const onWeekLoaded = (d) => { setStaff(d.staff); setPendingOff(d.pending_time_off); };
  const refreshPending = () => adminAPI.scheduleWeek(week).then(onWeekLoaded).catch(() => {});
  useEffect(() => { if (tab !== 'planner') refreshPending(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="page-hdr">
        <div>
          <p className="page-title"><CalendarClock size={20} style={{ verticalAlign: -3, marginRight: 6 }} />Staff Schedule</p>
          <p className="page-sub">Plan shifts, text staff their week, and track hours and time off</p>
        </div>
      </div>
      <div className="ss-tabs" role="tablist">
        {[['planner', 'Planner'], ['hours', 'Hours'], ['timeoff', 'Time off']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`ss-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
            {l}{k === 'timeoff' && pendingOff > 0 && <span className="ss-count">{pendingOff}</span>}
          </button>
        ))}
      </div>
      {tab === 'planner' && <Planner week={week} setWeek={setWeek} onWeekLoaded={onWeekLoaded} />}
      {tab === 'hours' && <Hours week={week} setWeek={setWeek} allStaff={staff} />}
      {tab === 'timeoff' && <TimeOff onChanged={refreshPending} />}
    </div>
  );
}
