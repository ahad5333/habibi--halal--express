import React, { useState, useEffect } from 'react';
import { Handshake, X, Check, ExternalLink, DollarSign } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Partners.css';
import { fmtDate } from '../utils/date.js';

const STATUS_BADGE = { pending:'badge-warning', approved:'badge-success', rejected:'badge-error' };

const PRICE_TIERS = ['Standard', 'Premium', 'Enterprise'];
const PAYMENT_OPTIONS = ['Net 30', 'Net 60', 'Prepaid', 'Cash on Delivery', 'Credit Card', 'ACH / Bank Transfer'];

export default function Partners() {
  const [apps, setApps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Approval fields
  const [note, setNote]             = useState('');
  const [priceTier, setPriceTier]   = useState('Standard');
  const [payMethods, setPayMethods] = useState([]);
  const [creditBal, setCreditBal]   = useState('');

  useEffect(() => {
    adminAPI.partners()
      .then(d => setApps(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openDetail = (app) => {
    setSelected(app);
    setNote(app.notes || '');
    setPriceTier(app.price_tier || 'Standard');
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
    } catch (_) {}
    finally { setUpdating(false); }
  };

  return (
    <div className="partners-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Partner Applications</p>
          <p className="page-sub">{apps.filter(a=>a.status==='pending').length} pending review</p>
        </div>
      </div>

      <div className="partners-layout">
        {/* List */}
        <div className="card" style={{padding:0,overflow:'hidden',flex:1}}>
          {loading ? (
            <div className="empty"><div className="spinner" /></div>
          ) : apps.length === 0 ? (
            <div className="empty"><Handshake size={36} /><p>No applications yet</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Business</th><th>Contact</th><th>Type</th><th>Tier</th><th>Submitted</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {apps.map(a => (
                    <tr key={a.id} onClick={() => openDetail(a)} style={{cursor:'pointer'}} className={selected?.id===a.id?'row-selected':''}>
                      <td style={{fontWeight:500}}>{a.business_name || a.company_name || '—'}</td>
                      <td className="text-muted" style={{fontSize:'0.78rem'}}>{a.contact_name || a.name || '—'}</td>
                      <td><span className="badge badge-muted">{a.business_type || a.partner_type || '—'}</span></td>
                      <td className="text-muted" style={{fontSize:'0.75rem'}}>{a.price_tier || '—'}</td>
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

              {/* Approved fields read-only */}
              {selected.status === 'approved' && (
                <>
                  {selected.price_tier && (
                    <div className="partner-field">
                      <p className="text-muted" style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>Price Tier</p>
                      <p style={{fontSize:'0.82rem'}}>{selected.price_tier}</p>
                    </div>
                  )}
                  {selected.credit_balance != null && parseFloat(selected.credit_balance) > 0 && (
                    <div className="partner-field">
                      <p className="text-muted" style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>Credit Balance</p>
                      <p style={{fontSize:'0.82rem'}}>${parseFloat(selected.credit_balance).toFixed(2)}</p>
                    </div>
                  )}
                  {Array.isArray(selected.payment_methods) && selected.payment_methods.length > 0 && (
                    <div className="partner-field" style={{gridColumn:'1/-1'}}>
                      <p className="text-muted" style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>Payment Methods</p>
                      <p style={{fontSize:'0.82rem'}}>{selected.payment_methods.join(', ')}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {selected.notes && (
              <div className="partner-notes">
                <p className="text-muted" style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.4rem'}}>Notes</p>
                <p style={{fontSize:'0.8rem',lineHeight:1.55}}>{selected.notes}</p>
              </div>
            )}

            {selected.certificate_path && (
              <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${selected.certificate_path}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                <ExternalLink size={12} /> View Certificate
              </a>
            )}

            {selected.status === 'pending' && (
              <div className="partner-actions">
                {/* Price Tier */}
                <div className="field">
                  <label>Price Tier</label>
                  <select className="input" value={priceTier} onChange={e => setPriceTier(e.target.value)}>
                    {PRICE_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Payment Methods */}
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

                {/* Credit Balance */}
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

                {/* Internal Note */}
                <div className="field">
                  <label>Internal Note (optional)</label>
                  <textarea className="input textarea" style={{minHeight:60}} placeholder="Leave a note..." value={note} onChange={e => setNote(e.target.value)} />
                </div>

                <div style={{display:'flex',gap:'0.5rem'}}>
                  <button className="btn btn-primary" style={{flex:1}} onClick={() => handleAction(selected.id,'approved')} disabled={updating}>
                    {updating ? <span className="spinner" style={{width:12,height:12}} /> : <><Check size={13} /> Approve</>}
                  </button>
                  <button className="btn btn-danger" style={{flex:1}} onClick={() => handleAction(selected.id,'rejected')} disabled={updating}>
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
