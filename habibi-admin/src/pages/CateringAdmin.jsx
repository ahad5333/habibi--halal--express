import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Mail, ChevronDown, ChevronUp, Users, CalendarDays, Send } from 'lucide-react';

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

const STATUS_BADGE = {
  pending:   { cls: 'badge-warning', label: 'Pending' },
  confirmed: { cls: 'badge-success', label: 'Confirmed' },
  cancelled: { cls: 'badge-error',   label: 'Cancelled' },
};

const fmt = (n) =>
  n != null ? `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function CateringAdmin() {
  const [quotes, setQuotes]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState(null);
  const [invoiceModal, setModal]     = useState(null); // { id, name, email }
  const [invoiceForm, setInvForm]   = useState({ quoted_price: '', admin_notes: '' });
  const [sending, setSending]       = useState(false);
  const [sendErr, setSendErr]       = useState('');
  const [sendOk, setSendOk]         = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/reservations/admin')
      .then(d => setQuotes(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
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
                      <span style={{fontWeight:700,color:'#f1f1f1',fontSize:'.9rem'}}>{q.name}</span>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      {q.invoice_sent && <span className="badge badge-muted">Invoice Sent</span>}
                    </div>
                    <div style={{display:'flex',gap:'1rem',marginTop:'.25rem',flexWrap:'wrap'}}>
                      <span style={{fontSize:'.78rem',color:'#6b7280',display:'flex',alignItems:'center',gap:'.3rem'}}>
                        <Users size={12}/> {q.party_size || q.guest_count} guests
                      </span>
                      <span style={{fontSize:'.78rem',color:'#6b7280',display:'flex',alignItems:'center',gap:'.3rem'}}>
                        <CalendarDays size={12}/> {fmtDate(q.scheduled_date)}
                      </span>
                      <span style={{fontSize:'.78rem',color:'#E5B64E',fontWeight:700}}>
                        Est. {fmt(q.estimated_total)}
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
                    {isOpen ? <ChevronUp size={16} style={{color:'#6b7280'}}/> : <ChevronDown size={16} style={{color:'#6b7280'}}/>}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{borderTop:'1px solid #1f1f1f',padding:'1rem 1.25rem',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'.75rem 1.5rem'}}>
                    <Detail label="Email"        value={q.email} />
                    <Detail label="Phone"        value={q.phone || '—'} />
                    <Detail label="Event Type"   value={q.event_type || '—'} />
                    <Detail label="Service"      value={q.service_type || '—'} style={{textTransform:'capitalize'}} />
                    <Detail label="Quoted Price" value={fmt(q.quoted_price)} color="#E5B64E" />
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
              <Mail size={18} style={{color:'#E5B64E'}} />
              <span style={{fontWeight:700,color:'#f1f1f1'}}>Send Invoice to {invoiceModal.name}</span>
            </div>
            <p style={{fontSize:'.82rem',color:'#6b7280',margin:0}}>{invoiceModal.email}</p>

            <div>
              <label style={{fontSize:'.75rem',fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:'.35rem'}}>
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
              <label style={{fontSize:'.75rem',fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:'.35rem'}}>
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
      <p style={{fontSize:'.85rem',color:color||'#d1d5db',margin:0,fontFamily:mono?'monospace':undefined,...extraStyle}}>{value}</p>
    </div>
  );
}
