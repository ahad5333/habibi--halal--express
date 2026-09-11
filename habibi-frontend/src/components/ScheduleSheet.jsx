import React, { useCallback, useEffect, useState } from 'react';
import { X, CalendarDays, LogIn, LogOut, Plus } from 'lucide-react';
import './ScheduleSheet.css';

// "My schedule" for staff (order-queue screen) and drivers (driver app):
// upcoming shifts, clock in/out, and time-off requests. The caller passes a
// `request(path, init)` that adds its own auth and returns parsed JSON, plus
// the paths for its API. Drivers clock in by going on duty, so for them
// `clockMode` is 'duty' and there's no button here.
const fmtDate = (ymd, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const fmtTime = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
const todayLocal = () => new Date().toLocaleDateString('en-CA');
const STATUS = {
  pending: { label: 'Waiting for approval', cls: 'pending' },
  approved: { label: 'Approved', cls: 'approved' },
  declined: { label: 'Declined', cls: 'declined' },
  cancelled: { label: 'Cancelled', cls: 'cancelled' },
};

export default function ScheduleSheet({ request, paths, clockMode = 'button', onClose }) {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [off, setOff] = useState({ start_date: '', end_date: '', reason: '' });

  const load = useCallback(() => request(paths.me).then(setData).catch(e => setMsg({ ok: false, text: e.message })), [request, paths.me]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { await fn(); if (okText) setMsg({ ok: true, text: okText }); await load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  const clockIn = () => act(() => request(paths.clockIn, { method: 'POST' }), 'Clocked in.');
  const clockOut = () => act(() => request(paths.clockOut, { method: 'POST' }), 'Clocked out.');
  const submitOff = (e) => {
    e.preventDefault();
    act(async () => {
      await request(paths.timeOff, { method: 'POST', body: JSON.stringify({ ...off, end_date: off.end_date || off.start_date }) });
      setAsking(false);
      setOff({ start_date: '', end_date: '', reason: '' });
    }, 'Request sent — your manager will approve or decline it.');
  };
  const cancelOff = (id) => act(() => request(paths.cancelTimeOff(id), { method: 'DELETE' }), 'Request cancelled.');

  const since = data?.clocked_in ? new Date(data.clocked_in.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <div className="sched-overlay" onClick={onClose}>
      <div className="sched" role="dialog" aria-label="My schedule" onClick={e => e.stopPropagation()}>
        <div className="sched-hdr">
          <span><CalendarDays size={16} /> My schedule</span>
          <button className="sched-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {!data ? <p className="sched-muted">{msg?.text || 'Loading…'}</p> : (
          <div className="sched-body">
            <div className={`sched-clock ${data.clocked_in ? 'on' : ''}`}>
              <div>
                <p className="sched-clock-state">{data.clocked_in ? `On the clock since ${since}` : 'Not clocked in'}</p>
                {clockMode === 'duty' && <p className="sched-muted-sm">You clock in and out by going on and off duty.</p>}
              </div>
              {clockMode === 'button' && (
                data.clocked_in
                  ? <button className="sched-btn out" disabled={busy} onClick={clockOut}><LogOut size={16} /> Clock out</button>
                  : <button className="sched-btn in" disabled={busy} onClick={clockIn}><LogIn size={16} /> Clock in</button>
              )}
            </div>

            {msg && <p className={`sched-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}

            <section>
              <p className="sched-label">Upcoming shifts</p>
              {data.shifts.length === 0 ? (
                <p className="sched-muted-sm">No shifts scheduled in the next two weeks.</p>
              ) : (
                <ul className="sched-shifts">
                  {data.shifts.map(s => (
                    <li key={s.id} className={s.is_now ? 'now' : s.date === todayLocal() ? 'today' : ''}>
                      <span className="sched-day">{s.date === todayLocal() ? 'Today' : fmtDate(s.date)}</span>
                      <span className="sched-time">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                      <span className="sched-where">{s.is_now ? 'Now · ' : ''}{s.location || ''}{s.note ? `${s.location ? ' · ' : ''}${s.note}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="sched-row-between">
                <p className="sched-label">Time off</p>
                {!asking && <button className="sched-link" onClick={() => setAsking(true)}><Plus size={13} /> Request time off</button>}
              </div>
              {asking && (
                <form className="sched-off-form" onSubmit={submitOff}>
                  <div className="sched-off-dates">
                    <label>First day<input type="date" required min={todayLocal()} value={off.start_date}
                                          onChange={e => setOff(o => ({ ...o, start_date: e.target.value }))} /></label>
                    <label>Last day<input type="date" min={off.start_date || todayLocal()} value={off.end_date}
                                         onChange={e => setOff(o => ({ ...o, end_date: e.target.value }))} /></label>
                  </div>
                  <input placeholder="Reason (optional)" maxLength={300} value={off.reason}
                         onChange={e => setOff(o => ({ ...o, reason: e.target.value }))} />
                  <div className="sched-off-actions">
                    <button type="button" className="sched-link" onClick={() => setAsking(false)}>Cancel</button>
                    <button type="submit" className="sched-btn in" disabled={busy || !off.start_date}>Send request</button>
                  </div>
                </form>
              )}
              {data.time_off.length === 0 && !asking ? (
                <p className="sched-muted-sm">No time-off requests.</p>
              ) : (
                <ul className="sched-offs">
                  {data.time_off.map(t => (
                    <li key={t.id}>
                      <span>{fmtDate(t.start_date)}{t.end_date !== t.start_date ? ` – ${fmtDate(t.end_date)}` : ''}</span>
                      <span className={`sched-status ${STATUS[t.status]?.cls}`}>{STATUS[t.status]?.label || t.status}</span>
                      {t.status === 'pending' && <button className="sched-link" disabled={busy} onClick={() => cancelOff(t.id)}>Cancel</button>}
                      {t.decision_note && <small>“{t.decision_note}”</small>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
