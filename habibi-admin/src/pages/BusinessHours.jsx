import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Save, CheckCircle, XCircle, Sun, Moon } from 'lucide-react';
import { adminAPI } from '../services/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LOCATIONS = [
  { id: 1, label: 'Location 1' },
  { id: 2, label: 'Location 2' },
  { id: 3, label: 'Location 3' },
];

function defaultHours() {
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    open_time:   '07:00',
    close_time:  '23:00',
    is_closed:   false,
    is_24h:      false,
  }));
}

// Convert "07:00:00" or "07:00" to "07:00"
function normalizeTime(t) {
  if (!t) return '07:00';
  return t.slice(0, 5);
}

export default function BusinessHours() {
  const [locationId, setLocationId] = useState(1);
  const [hours, setHours]           = useState(defaultHours());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null); // { type: 'success'|'error', msg }
  const [isOpenNow, setIsOpenNow]   = useState(null);
  const [locationTitle, setLocationTitle] = useState('');

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (locId) => {
    setLoading(true);
    try {
      // Fetch location title from admin locations endpoint
      const [bhData, locData] = await Promise.all([
        adminAPI.getBusinessHours(locId),
        adminAPI.getLocations().catch(() => ({ rows: [] })),
      ]);

      // Normalise hours — sort by day_of_week, fill in missing days
      const rawHours = Array.isArray(bhData.hours) ? bhData.hours : defaultHours();
      const sorted   = [...rawHours].sort((a, b) => a.day_of_week - b.day_of_week);
      const filled   = Array.from({ length: 7 }, (_, i) => {
        const found = sorted.find(h => h.day_of_week === i);
        return found
          ? { ...found, open_time: normalizeTime(found.open_time), close_time: normalizeTime(found.close_time) }
          : { day_of_week: i, open_time: '07:00', close_time: '23:00', is_closed: false, is_24h: false };
      });
      setHours(filled);

      // Location title + is_open_now from public endpoint (best-effort)
      try {
        const pubData = await fetch('/api/business-hours').then(r => r.ok ? r.json() : []);
        const locEntry = Array.isArray(pubData) ? pubData.find(l => l.location_id === locId) : null;
        if (locEntry) {
          setLocationTitle(locEntry.title || `Location ${locId}`);
          setIsOpenNow(locEntry.is_open_now);
        } else {
          setLocationTitle(`Location ${locId}`);
          setIsOpenNow(null);
        }
      } catch (_) {
        // public endpoint may not be available during dev — not fatal
        setLocationTitle(`Location ${locId}`);
        setIsOpenNow(null);
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to load business hours');
      setHours(defaultHours());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(locationId);
  }, [locationId, load]);

  const updateRow = (dayIndex, field, value) => {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayIndex ? { ...h, [field]: value } : h
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.saveBusinessHours({ location_id: locationId, hours });
      showToast('success', 'Business hours saved successfully');
      // Reload to pick up any server-side normalisation
      await load(locationId);
    } catch (err) {
      showToast('error', err.message || 'Failed to save business hours');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(220,38,38,0.35)'}`,
          color: toast.type === 'success' ? '#4ade80' : '#f87171',
          padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
          fontSize: '0.83rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}>
          {toast.type === 'success'
            ? <CheckCircle size={15} />
            : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-hdr">
        <div>
          <p className="page-title">Business Hours</p>
          <p className="page-sub">
            {locationTitle
              ? `Managing hours for ${locationTitle}`
              : 'Set open / close times for each day of the week'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Open/closed badge */}
          {isOpenNow === true  && <span className="badge badge-success"><Sun size={10} /> Currently Open</span>}
          {isOpenNow === false && <span className="badge badge-error"><Moon size={10} /> Currently Closed</span>}

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving
              ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</>
              : <><Save size={14} /> Save Hours</>}
          </button>
        </div>
      </div>

      {/* Location Selector */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.875rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Clock size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Location
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {LOCATIONS.map(loc => (
              <button
                key={loc.id}
                onClick={() => setLocationId(loc.id)}
                className={`btn btn-sm ${locationId === loc.id ? 'btn-primary' : 'btn-secondary'}`}
              >
                {locationTitle && loc.id === locationId ? locationTitle : loc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hours table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Day</th>
                  <th style={{ width: 90 }}>Closed</th>
                  <th style={{ width: 90 }}>24 Hours</th>
                  <th>Open Time</th>
                  <th>Close Time</th>
                  <th style={{ width: 110 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {hours.map(row => {
                  const disabled = row.is_closed || row.is_24h;
                  return (
                    <tr key={row.day_of_week}>
                      {/* Day name */}
                      <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                        {DAY_NAMES[row.day_of_week]}
                      </td>

                      {/* Closed toggle */}
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!row.is_closed}
                            onChange={e => {
                              updateRow(row.day_of_week, 'is_closed', e.target.checked);
                              if (e.target.checked) updateRow(row.day_of_week, 'is_24h', false);
                            }}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Closed</span>
                        </label>
                      </td>

                      {/* 24h toggle */}
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!row.is_24h}
                            onChange={e => {
                              updateRow(row.day_of_week, 'is_24h', e.target.checked);
                              if (e.target.checked) updateRow(row.day_of_week, 'is_closed', false);
                            }}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>24h</span>
                        </label>
                      </td>

                      {/* Open time */}
                      <td>
                        {row.is_24h ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Open 24 Hours</span>
                        ) : (
                          <input
                            type="time"
                            className="input"
                            style={{ width: 130, opacity: row.is_closed ? 0.4 : 1 }}
                            value={row.open_time || '07:00'}
                            disabled={!!row.is_closed}
                            onChange={e => updateRow(row.day_of_week, 'open_time', e.target.value)}
                          />
                        )}
                      </td>

                      {/* Close time */}
                      <td>
                        {row.is_24h ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>
                        ) : (
                          <input
                            type="time"
                            className="input"
                            style={{ width: 130, opacity: row.is_closed ? 0.4 : 1 }}
                            value={row.close_time || '23:00'}
                            disabled={!!row.is_closed}
                            onChange={e => updateRow(row.day_of_week, 'close_time', e.target.value)}
                          />
                        )}
                      </td>

                      {/* Status badge */}
                      <td>
                        {row.is_closed
                          ? <span className="badge badge-error">Closed</span>
                          : row.is_24h
                          ? <span className="badge badge-info">24 Hours</span>
                          : <span className="badge badge-success">Open</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview text */}
      {!loading && (
        <div className="card" style={{ marginTop: '1.25rem', padding: '0.875rem 1.25rem' }}>
          <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
            Hours Text Preview
          </p>
          <p style={{ fontSize: '0.83rem', color: 'var(--color-text-main)', lineHeight: 1.7 }}>
            {buildPreview(hours)}
          </p>
          <p style={{ fontSize: '0.71rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
            This text is auto-generated and stored in the locations table after saving.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Client-side preview builder (mirrors server logic) ───────────────────────
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime12(t) {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const suffix = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

function buildPreview(rows) {
  const sorted = [...rows].sort((a, b) => a.day_of_week - b.day_of_week);
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

  return groups.map(g => {
    const label = g.start === g.end
      ? DAY_ABBR[g.start]
      : `${DAY_ABBR[g.start]}–${DAY_ABBR[g.end]}`;
    if (g.key === '24h')    return `${label}: Open 24 Hours`;
    if (g.key === 'closed') return `${label}: Closed`;
    return `${label}: ${formatTime12(g.row.open_time)} – ${formatTime12(g.row.close_time)}`;
  }).join(' · ');
}
