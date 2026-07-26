import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Mail, ChevronDown, ChevronUp, Users, CalendarDays, Send, CheckCircle2, XCircle, Bell } from 'lucide-react';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';
import { unlockAudio, playBell, showNewOrderNotification } from '../utils/orderAlerts';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `${res.status}`);
  return data;
}

const STATUS_BADGE = {
  pending:   { cls: 'badge-warning', label: 'Pending' },
  quoted:    { cls: 'badge-info',    label: 'Quoted' },
  confirmed: { cls: 'badge-success', label: 'Confirmed' },
  cancelled: { cls: 'badge-error',   label: 'Cancelled' },
};

const fmt = (n) =>
  n != null ? `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—';


export default function CateringAdmin() {
  const [quotes, setQuotes]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState(null);
  const [invoiceModal, setModal]     = useState(null); // { id, name, email }
  const [invoiceForm, setInvForm]   = useState({ quoted_price: '', admin_notes: '' });
  const [sending, setSending]       = useState(false);
  const [sendErr, setSendErr]       = useState('');
  const [sendOk, setSendOk]         = useState(false);
  const [soundOn, setSoundOn]       = useState(() => localStorage.getItem('habibi_sound_on') === '1');
  const [updatingId, setUpdatingId] = useState(null);
  const knownIds = useRef(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    apiFetch('/api/reservations/admin?type=catering')
      .then(d => {
        const list = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
        setQuotes(list);

        const openQuotes = list.filter(q => q.status === 'pending' || !q.status);
        if (knownIds.current !== null) {
          const incoming = openQuotes.filter(q => !knownIds.current.has(q.id));
          if (incoming.length > 0) {
            showNewOrderNotification(incoming.length);
            if (soundOn) playBell();
          }
        }
        knownIds.current = new Set(openQuotes.map(q => q.id));
      })
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, [soundOn]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Catering leads carry a 12–24h promised response time (not a minutes-level
  // SLA like urgent requests), so a quiet 30s poll + one-time bell on arrival
  // is enough — no need for the continuous ring used on time-critical pages.
  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const handleEnableSound = () => {
    unlockAudio();
    setSoundOn(true);
    localStorage.setItem('habibi_sound_on', '1');
    setTimeout(playBell, 100);
  };

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await apiFetch(`/api/reservations/admin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      alert(`Failed to update quote: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const openInvoice = (q) => {
    setInvForm({ quoted_price: q.quoted_price || q.estimated_total || '', admin_notes: q.admin_notes || '' });
    setSendErr(''); setSendOk(false);
    setModal(q);
  };

  const sendInvoice = async () => {
    if (!invoiceForm.quoted_price) { setSendErr('Quoted price is required.'); return; }
    setSending(true); setSendErr(''); setSendOk(false);
    try {
      await apiFetch(`/api/reservations/admin/${invoiceModal.id}/invoice`, {
        method: 'POST',
        body: JSON.stringify({
          quoted_price: parseFloat(invoiceForm.quoted_price),
          admin_notes:  invoiceForm.admin_notes,
        }),
      });
      setSendOk(true);
      load();
      setTimeout(() => setModal(null), 1800);
    } catch (err) {
      setSendErr(err.message || 'Failed to send invoice.');
    } finally {
      setSending(false);
    }
  };

  const pending   = quotes.filter(q => q.status === 'pending' || !q.status);
  const confirmed = quotes.filter(q => q.status === 'confirmed');
  const other     = quotes.filter(q => q.status && q.status !== 'pending' && q.status !== 'confirmed');

  return (
    <div className="page-wrap">
      <div className="page-hdr">
        <div>
          <p className="page-title">Catering Quotes</p>
          <p className="page-sub">{pending.length} pending · {confirmed.length} confirmed · {quotes.length} total</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button
            className={`btn btn-sm ${soundOn ? 'btn-success' : 'btn-warning'}`}
            onClick={soundOn ? playBell : handleEnableSound}
            title={soundOn ? 'Sound enabled — click to test bell' : 'Click to enable new-quote bell alerts'}
            style={{gap:'0.4rem'}}
          >
            <Bell size={14}/> {soundOn ? 'Sound On' : 'Enable Sound'}
          </button>
          <button className="btn btn-secondary" onClick={() => load()}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="empty"><div className="spinner" /></div>
      ) : quotes.length === 0 ? (
        <div className="empty" style={{marginTop:'3rem'}}>
          <CalendarDays size={40} style={{color:'#4b5563'}} />
          <p style={{color:'#6b7280',marginTop:'.75rem'}}>No catering quotes yet</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
          {[...pending, ...confirmed, ...other].map(q => {
            const badge  = STATUS_BADGE[q.status] || STATUS_BADGE.pending;
            const isOpen = expanded === q.id;
            return (
              <div key={q.id} className="card" style={{padding:0,overflow:'hidden'}}>
                {/* Row header */}
                <div
                  style={{display:'flex',alignItems:'center',gap:'1rem',padding:'1rem 1.25rem',cursor:'pointer'}}
                  onClick={() => setExpanded(isOpen ? null : q.id)}
                >
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                      <span style={{fontWeight:700,color:'#111827',fontSize:'.9rem'}}>{q.name}</span>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      {q.invoice_sent && <span className="badge badge-muted">Invoice Sent</span>}
                    </div>
                    <div style={{display:'flex',gap:'1rem',marginTop:'.25rem',flexWrap:'wrap'}}>
                      <span style={{fontSize:'.78rem',color:'#374151',display:'flex',alignItems:'center',gap:'.3rem'}}>
                        <Users size={12}/> {q.party_size || q.guest_count} guests
                      </span>
                      <span style={{fontSize:'.78rem',color:'#374151',display:'flex',alignItems:'center',gap:'.3rem'}}>
                        <CalendarDays size={12}/> {fmtDateTime(q.scheduled_date)}
                      </span>
                      <span style={{fontSize:'.78rem',color:'#2563eb',fontWeight:700}}>
                        {q.quoted_price ? `Quote ${fmt(q.quoted_price)}` : `Est. ${fmt(q.estimated_total)}`}
                      </span>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem',flexShrink:0}}>
                    {!q.invoice_sent && (
                      <button
                        className="btn btn-primary"
                        style={{fontSize:'.78rem',padding:'.4rem .85rem'}}
                        onClick={e => { e.stopPropagation(); openInvoice(q); }}
                      >
                        <Send size={13}/> Send Invoice
                      </button>
                    )}
                    {q.status !== 'confirmed' && q.status !== 'cancelled' && (
                      <button
                        className="btn btn-success"
                        style={{fontSize:'.78rem',padding:'.4rem .85rem'}}
                        disabled={updatingId === q.id}
                        onClick={e => { e.stopPropagation(); updateStatus(q.id, 'confirmed'); }}
                      >
                        <CheckCircle2 size={13}/> Confirm
                      </button>
                    )}
                    {q.status !== 'cancelled' && (
                      <button
                        className="btn btn-secondary"
                        style={{fontSize:'.78rem',padding:'.4rem .85rem',color:'#dc2626'}}
                        disabled={updatingId === q.id}
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`Cancel this catering quote for ${q.name}?`)) updateStatus(q.id, 'cancelled');
                        }}
                      >
                        <XCircle size={13}/> Cancel
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} style={{color:'#6b7280'}}/> : <ChevronDown size={16} style={{color:'#6b7280'}}/>}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{borderTop:'1px solid #e5e7eb',padding:'1rem 1.25rem',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'.75rem 1.5rem'}}>
                    <Detail label="Email"        value={q.email} />
                    <Detail label="Phone"        value={q.phone || '—'} />
                    <Detail label="Event Type"   value={q.event_type || '—'} />
                    <Detail label="Service"      value={q.service_type || '—'} style={{textTransform:'capitalize'}} />
                    {q.event_address && <Detail label="Address" value={q.event_address} full />}
                    <Detail label="Quoted Price" value={fmt(q.quoted_price)} color="#2563eb" />
                    <Detail label="Reference"    value={`#CAT-${String(q.id).padStart(4,'0')}`} mono />
                    {q.notes && <Detail label="Notes" value={q.notes} full />}
                    {q.admin_notes && <Detail label="Admin Notes" value={q.admin_notes} full />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice modal */}
      {invoiceModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div className="card" style={{width:'100%',maxWidth:'460px',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
              <Mail size={18} style={{color:'#2563eb'}} />
              <span style={{fontWeight:700,color:'#111827'}}>Send Invoice to {invoiceModal.name}</span>
            </div>
            <p style={{fontSize:'.82rem',color:'#374151',margin:0}}>{invoiceModal.email}</p>

            <div>
              <label style={{fontSize:'.75rem',fontWeight:600,color:'#374151',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:'.35rem'}}>
                Quoted Price *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                placeholder="e.g. 480"
                value={invoiceForm.quoted_price}
                onChange={e => setInvForm(f => ({ ...f, quoted_price: e.target.value }))}
              />
            </div>

            <div>
              <label style={{fontSize:'.75rem',fontWeight:600,color:'#374151',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:'.35rem'}}>
                Admin Notes / Invoice Details
              </label>
              <textarea
                className="input"
                style={{resize:'vertical',minHeight:'80px'}}
                placeholder="Menu breakdown, deposit terms, special instructions..."
                value={invoiceForm.admin_notes}
                onChange={e => setInvForm(f => ({ ...f, admin_notes: e.target.value }))}
              />
            </div>

            {sendErr && (
              <p style={{fontSize:'.82rem',color:'#f87171',margin:0}}>⚠ {sendErr}</p>
            )}
            {sendOk && (
              <p style={{fontSize:'.82rem',color:'#22c55e',margin:0}}>✓ Invoice sent successfully!</p>
            )}

            <div style={{display:'flex',gap:'.75rem',justifyContent:'flex-end'}}>
              <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={sending}>Cancel</button>
              <button className="btn btn-primary" onClick={sendInvoice} disabled={sending}>
                {sending ? 'Sending…' : <><Send size={13}/> Send Invoice</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, color, mono, full, style: extraStyle }) {
  return (
    <div style={full ? {gridColumn:'1/-1'} : {}}>
      <p style={{fontSize:'.72rem',color:'#6b7280',margin:'0 0 .2rem',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</p>
      <p style={{fontSize:'.85rem',color:color||'#111827',margin:0,fontFamily:mono?'monospace':undefined,...extraStyle}}>{value}</p>
    </div>
  );
}
