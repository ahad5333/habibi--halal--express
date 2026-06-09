import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CalendarDays, Users, Clock, MapPin, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function token() { return localStorage.getItem('habibi_admin_token'); }

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `${res.status}`);
  return data;
}

function parseNotes(notes = '') {
  const result = { time: '', extra: '' };
  notes.split(' | ').forEach(p => {
    if (p.startsWith('Time: '))  result.time  = p.replace('Time: ', '');
    if (p.startsWith('Notes: ')) result.extra = p.replace('Notes: ', '');
  });
  return result;
}

const SC = {
  pending:   { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)', text: '#fbbf24', label: 'Pending'   },
  confirmed: { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)',  text: '#22c55e', label: 'Confirmed' },
  cancelled: { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)', text: '#ef4444', label: 'Cancelled' },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const fmtSubmitted = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function TableReservations() {
  const [list, setList]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all');
  const [expanded, setExpanded]       = useState(null);
  const [modal, setModal]             = useState(null); // { id, name, action }
  const [tableNote, setTableNote]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [saveErr, setSaveErr]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/reservations/admin?type=table')
      .then(d => setList(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    all:       list.length,
    pending:   list.filter(r => !r.status || r.status === 'pending').length,
    confirmed: list.filter(r => r.status === 'confirmed').length,
    cancelled: list.filter(r => r.status === 'cancelled').length,
  };

  const visible = filter === 'all'
    ? list
    : list.filter(r => (r.status || 'pending') === filter);

  const openModal = (r, action) => {
    setModal({ id: r.id, name: r.name, action });
    setTableNote(action === 'confirm' ? (r.admin_notes || '') : '');
    setSaveErr('');
  };

  const submit = async () => {
    setSaving(true); setSaveErr('');
    try {
      await apiFetch(`/api/reservations/admin/${modal.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status:      modal.action === 'confirm' ? 'confirmed' : 'cancelled',
          admin_notes: tableNote.trim() || null,
        }),
      });
      setModal(null);
      load();
    } catch (e) {
      setSaveErr(e.message || 'Failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-hdr">
        <div>
          <p className="page-title">Table Reservations</p>
          <p className="page-sub">
            {counts.pending} pending &nbsp;·&nbsp; {counts.confirmed} confirmed &nbsp;·&nbsp; {counts.all} total
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['all', 'pending', 'confirmed', 'cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '.38rem .9rem',
              borderRadius: '20px',
              border: filter === f ? '1px solid #E5B64E' : '1px solid #2a2a2a',
              background: filter === f ? 'rgba(229,182,78,0.1)' : 'transparent',
              color: filter === f ? '#E5B64E' : '#6b7280',
              fontWeight: 600,
              fontSize: '.78rem',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f}
            {counts[f] > 0 && (
              <span style={{ marginLeft: '.3rem', opacity: .65 }}>({counts[f]})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="empty"><div className="spinner" /></div>
      ) : visible.length === 0 ? (
        <div className="empty" style={{ marginTop: '3rem' }}>
          <CalendarDays size={40} style={{ color: '#4b5563' }} />
          <p style={{ color: '#6b7280', marginTop: '.75rem' }}>
            No {filter === 'all' ? '' : filter} table reservations
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
          {visible.map(r => {
            const parsed    = parseNotes(r.notes);
            const sc        = SC[r.status] || SC.pending;
            const isOpen    = expanded === r.id;
            const isPending = !r.status || r.status === 'pending';
            const contact   = r.email || r.phone || '—';

            return (
              <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#f1f1f1', fontSize: '.9rem' }}>{r.name}</span>
                      <span style={{
                        padding: '.15rem .55rem',
                        borderRadius: '20px',
                        background: sc.bg,
                        border: `1px solid ${sc.border}`,
                        color: sc.text,
                        fontSize: '.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                      }}>
                        {sc.label}
                      </span>
                      {r.admin_notes && (
                        <span style={{ fontSize: '.75rem', color: '#E5B64E', fontWeight: 600 }}>
                          📍 {r.admin_notes}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '.85rem', marginTop: '.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.78rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        <MapPin size={11} /> {r.event_type || '—'}
                      </span>
                      <span style={{ fontSize: '.78rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        <CalendarDays size={11} /> {fmtDate(r.scheduled_date)}
                      </span>
                      <span style={{ fontSize: '.78rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        <Clock size={11} /> {parsed.time || '—'}
                      </span>
                      <span style={{ fontSize: '.78rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        <Users size={11} /> {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
                    {isPending && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); openModal(r, 'confirm'); }}
                          style={{ padding: '.38rem .8rem', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600, fontSize: '.76rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.3rem' }}
                        >
                          <CheckCircle2 size={13} /> Confirm
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); openModal(r, 'cancel'); }}
                          style={{ padding: '.38rem .8rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 600, fontSize: '.76rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.3rem' }}
                        >
                          <XCircle size={13} /> Cancel
                        </button>
                      </>
                    )}
                    {isOpen
                      ? <ChevronUp size={16} style={{ color: '#6b7280' }} />
                      : <ChevronDown size={16} style={{ color: '#6b7280' }} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #1f1f1f', padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.75rem 1.5rem' }}>
                    <Detail label="Contact"   value={contact} />
                    <Detail label="Ref #"     value={`#TBL-${String(r.id).padStart(4, '0')}`} mono />
                    <Detail label="Submitted" value={fmtSubmitted(r.created_at)} />
                    {r.admin_notes && <Detail label="Assigned Table" value={r.admin_notes} color="#E5B64E" />}
                    {parsed.extra && <Detail label="Special Requests" value={parsed.extra} full />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm / Cancel modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              {modal.action === 'confirm'
                ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
                : <XCircle size={18} style={{ color: '#ef4444' }} />}
              <span style={{ fontWeight: 700, color: '#f1f1f1', fontSize: '.95rem' }}>
                {modal.action === 'confirm' ? 'Confirm' : 'Cancel'} reservation for <em style={{ fontStyle: 'normal', color: '#E5B64E' }}>{modal.name}</em>?
              </span>
            </div>

            {modal.action === 'confirm' && (
              <div>
                <label style={{ fontSize: '.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: '.35rem' }}>
                  Assign Table &nbsp;<span style={{ fontWeight: 400, textTransform: 'none', color: '#6b7280' }}>(optional)</span>
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Table 4, Booth B, Patio..."
                  value={tableNote}
                  onChange={e => setTableNote(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
                <p style={{ fontSize: '.75rem', color: '#6b7280', marginTop: '.4rem' }}>
                  Leave blank if you haven't assigned a table yet.
                </p>
              </div>
            )}

            {saveErr && (
              <p style={{ fontSize: '.82rem', color: '#f87171', margin: 0 }}>⚠ {saveErr}</p>
            )}

            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={saving}>
                Back
              </button>
              <button
                onClick={submit}
                disabled={saving}
                style={{
                  padding: '.45rem 1.2rem',
                  borderRadius: '8px',
                  border: modal.action === 'confirm' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.25)',
                  background: modal.action === 'confirm' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                  color: modal.action === 'confirm' ? '#22c55e' : '#ef4444',
                  fontWeight: 600,
                  fontSize: '.85rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? .6 : 1,
                }}
              >
                {saving ? 'Saving…' : modal.action === 'confirm' ? '✓ Yes, Confirm' : '✕ Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, color, mono, full }) {
  return (
    <div style={full ? { gridColumn: '1/-1' } : {}}>
      <p style={{ fontSize: '.72rem', color: '#6b7280', margin: '0 0 .2rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
      <p style={{ fontSize: '.85rem', color: color || '#d1d5db', margin: 0, fontFamily: mono ? 'monospace' : undefined }}>{value}</p>
    </div>
  );
}
