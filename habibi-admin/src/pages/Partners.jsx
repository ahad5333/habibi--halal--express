import React, { useState, useEffect, useMemo } from 'react';
import { Handshake, X, Check, ExternalLink, DollarSign, ShieldOff, RotateCcw } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Partners.css';
import { fmtDate } from '../utils/date.js';

const STATUS_BADGE = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-error' };
const STATUS_TABS = [
  { value: 'all',      label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// Matches the vocabulary the Partner Portal's catalog pricing and display already use
// (partnerPortalController.js / PartnerPortal.jsx) — keeping these in sync so a tier
// picked here actually changes the price a partner sees, instead of being a no-op.
const PRICE_TIERS = [
  { value: 'tier_1', label: 'Standard' },
  { value: 'tier_2', label: 'Silver' },
  { value: 'tier_3', label: 'Gold' },
];
const PRICE_TIER_LABEL = Object.fromEntries(PRICE_TIERS.map(t => [t.value, t.label]));
const PAYMENT_OPTIONS = ['Net 30', 'Net 60', 'Prepaid', 'Cash on Delivery', 'Credit Card', 'ACH / Bank Transfer'];

export default function Partners() {
  const [apps, setApps]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch]     = useState('');
  const [statusTab, setStatusTab] = useState('all');

  // Editable fields
  const [note, setNote]             = useState('');
  const [priceTier, setPriceTier]   = useState('tier_1');
  const [payMethods, setPayMethods] = useState([]);
  const [creditBal, setCreditBal]   = useState('');

  const load = () => {
    setLoading(true);
    adminAPI.partners()
      .then(d => setApps(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = (app) => {
    setSelected(app);
    setNote(app.notes || '');
    setPriceTier(app.price_tier || 'tier_1');
    const pm = Array.isArray(app.payment_methods) ? app.payment_methods
             : (typeof app.payment_methods === 'string' ? JSON.parse(app.payment_methods || '[]') : []);
    setPayMethods(pm);
    setCreditBal(app.credit_balance != null ? String(app.credit_balance) : '');
  };

  const toggleMethod = (m) => setPayMethods(prev =>
    prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
  );

  const handleAction = async (id, status) => {
    setUpdating(true);
    try {
      const updated = await adminAPI.updatePartner(id, status, note, priceTier, payMethods, creditBal !== '' ? parseFloat(creditBal) : null);
      const app = updated?.application || { id, status, notes: note, price_tier: priceTier, payment_methods: payMethods, credit_balance: creditBal };
      setApps(prev => prev.map(a => a.id === id ? { ...a, ...app } : a));
      setSelected(prev => prev?.id === id ? { ...prev, ...app } : prev);
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter(a => {
      if (statusTab !== 'all' && (a.status || 'pending') !== statusTab) return false;
      if (!q) return true;
      return [a.business_name, a.company_name, a.contact_name, a.name, a.email].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [apps, search, statusTab]);

  const counts = useMemo(() => {
    const c = { all: apps.length, pending: 0, approved: 0, rejected: 0 };
    apps.forEach(a => { c[a.status || 'pending'] = (c[a.status || 'pending'] || 0) + 1; });
    return c;
  }, [apps]);

  return (
    <div className="partners-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Partner Applications</p>
          <p className="page-sub">{counts.pending} pending review</p>
        </div>
      </div>

      <div className="card partner-toolbar">
        <input className="input" style={{ minWidth: 220, flex: 1 }} placeholder="Search business, contact, email…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="partner-status-tabs">
          {STATUS_TABS.map(t => (
            <button key={t.value} className={`partner-status-tab ${statusTab === t.value ? 'active' : ''}`} onClick={() => setStatusTab(t.value)}>
              {t.label} <span className="partner-status-tab-count">{counts[t.value] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="partners-layout">
        {/* List */}
        <div className="card" style={{padding:0,overflow:'hidden',flex:1}}>
          {loading ? (
            <div className="empty"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty"><Handshake size={36} /><p>No applications found</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Business</th><th>Contact</th><th>Type</th><th>Tier</th><th>Submitted</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id} onClick={() => openDetail(a)} style={{cursor:'pointer'}} className={selected?.id===a.id?'row-selected':''}>
                      <td style={{fontWeight:500}}>{a.business_name || a.company_name || '—'}</td>
                      <td className="text-muted" style={{fontSize:'0.78rem'}}>{a.contact_name || a.name || '—'}</td>
                      <td><span className="badge badge-muted">{a.business_type || a.partner_type || '—'}</span></td>
                      <td className="text-muted" style={{fontSize:'0.75rem'}}>{PRICE_TIER_LABEL[a.price_tier] || a.price_tier || '—'}</td>
                      <td className="text-muted" style={{fontSize:'0.72rem', whiteSpace:'nowrap'}}>
                        {a.created_at ? fmtDate(a.created_at, {month:'short',day:'numeric',year:'numeric'}) : '—'}
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[a.status]||'badge-muted'}`}>{a.status||'pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail */}
        {selected && (
          <div className="partner-detail card">
            <div className="cust-detail-hdr">
              <div style={{flex:1}}>
                <p style={{fontWeight:600}}>{selected.business_name || selected.company_name}</p>
                <span className={`badge ${STATUS_BADGE[selected.status]||'badge-muted'}`}>{selected.status||'pending'}</span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            <div className="partner-fields">
              {[
                ['Contact', selected.contact_name || selected.name],
                ['Email', selected.email],
                ['Phone', selected.phone],
                ['Type', selected.business_type || selected.partner_type],
                ['Website', selected.website],
                ['Est. Order Volume', selected.monthly_order_volume || selected.estimated_orders],
              ].filter(([,v]) => v).map(([label, val]) => (
                <div key={label} className="partner-field">
                  <p className="text-muted" style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</p>
                  <p style={{fontSize:'0.82rem'}}>{val}</p>
                </div>
              ))}
            </div>

            {selected.certificate_path && (
              <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${selected.certificate_path}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                <ExternalLink size={12} /> View Certificate
              </a>
            )}

            {/* Editable terms — available regardless of status, so approved partners' terms
                can be adjusted and rejected applications can be reconsidered. */}
            <div className="partner-actions">
              <div className="field">
                <label>Price Tier</label>
                <select className="input" value={priceTier} onChange={e => setPriceTier(e.target.value)}>
                  {PRICE_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Accepted Payment Methods</label>
                <div className="partner-pay-methods">
                  {PAYMENT_OPTIONS.map(m => (
                    <label key={m} className="partner-pay-check">
                      <input type="checkbox" checked={payMethods.includes(m)} onChange={() => toggleMethod(m)} />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Credit Balance (optional)</label>
                <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                  <DollarSign size={13} style={{position:'absolute',left:'0.75rem',color:'#777',pointerEvents:'none'}} />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={creditBal}
                    onChange={e => setCreditBal(e.target.value)}
                    style={{paddingLeft:'2rem'}}
                  />
                </div>
              </div>

              <div className="field">
                <label>Internal Note (optional)</label>
                <textarea className="input textarea" style={{minHeight:60}} placeholder="Leave a note..." value={note} onChange={e => setNote(e.target.value)} />
              </div>

              {selected.status === 'pending' && (
                <div style={{display:'flex',gap:'0.5rem'}}>
                  <button className="btn btn-primary" style={{flex:1}} onClick={() => handleAction(selected.id,'approved')} disabled={updating}>
                    {updating ? <span className="spinner" style={{width:12,height:12}} /> : <><Check size={13} /> Approve</>}
                  </button>
                  <button className="btn btn-danger" style={{flex:1}} onClick={() => handleAction(selected.id,'rejected')} disabled={updating}>
                    <X size={13} /> Reject
                  </button>
                </div>
              )}

              {selected.status === 'approved' && (
                <div style={{display:'flex',gap:'0.5rem'}}>
                  <button className="btn btn-primary" style={{flex:1}} onClick={() => handleAction(selected.id,'approved')} disabled={updating}>
                    {updating ? <span className="spinner" style={{width:12,height:12}} /> : <><Check size={13} /> Save Changes</>}
                  </button>
                  <button className="btn btn-danger" style={{flex:1}} onClick={() => handleAction(selected.id,'rejected')} disabled={updating} title="Cuts off portal access; account and order history are kept">
                    <ShieldOff size={13} /> Revoke Access
                  </button>
                </div>
              )}

              {selected.status === 'rejected' && (
                <div style={{display:'flex',gap:'0.5rem'}}>
                  <button className="btn btn-primary" style={{flex:1}} onClick={() => handleAction(selected.id,'approved')} disabled={updating}>
                    {updating ? <span className="spinner" style={{width:12,height:12}} /> : <><RotateCcw size={13} /> Reconsider &amp; Approve</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
