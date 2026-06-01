import React, { useState, useEffect } from 'react';
import { Handshake, X, Check, ExternalLink } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Partners.css';

const STATUS_BADGE = { pending:'badge-warning', approved:'badge-success', rejected:'badge-error' };

export default function Partners() {
  const [apps, setApps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [note, setNote]       = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    adminAPI.partners()
      .then(d => setApps(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id, status) => {
    setUpdating(true);
    try {
      await adminAPI.updatePartner(id, status, note);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
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
                  <tr><th>Business</th><th>Contact</th><th>Type</th><th>Submitted</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {apps.map(a => (
                    <tr key={a.id} onClick={() => { setSelected(a); setNote(''); }} style={{cursor:'pointer'}} className={selected?.id===a.id?'row-selected':''}>
                      <td style={{fontWeight:500}}>{a.business_name || a.company_name || '—'}</td>
                      <td className="text-muted" style={{fontSize:'0.78rem'}}>{a.contact_name || a.name || '—'}</td>
                      <td><span className="badge badge-muted">{a.business_type || a.partner_type || '—'}</span></td>
                      <td className="text-muted" style={{fontSize:'0.72rem', whiteSpace:'nowrap'}}>
                        {a.created_at ? new Date(a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
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
