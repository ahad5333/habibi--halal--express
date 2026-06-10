import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, RefreshCw, X } from 'lucide-react';
import { adminAPI } from '../services/api';
import './UrgentRequests.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const URGENCY_BADGE = { High:'badge-error', Normal:'badge-warning', Low:'badge-muted' };

export default function UrgentRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  const fetch = () => {
    setLoading(true);
    adminAPI.urgent()
      .then(d => setRequests(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const unread = requests.filter(r => !r.resolved).length;

  return (
    <div className="urgent-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Urgent Requests</p>
          <p className="page-sub">{unread} unresolved · {requests.length} total</p>
        </div>
        <button className="btn btn-secondary" onClick={fetch}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="urg-admin-layout">
        {/* List */}
        <div className="card" style={{padding:0,overflow:'hidden',flex:1}}>
          {loading ? (
            <div className="empty"><div className="spinner" /></div>
          ) : requests.length === 0 ? (
            <div className="empty"><AlertTriangle size={36} /><p>No urgent requests</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Customer</th><th>Phone</th><th>Order</th><th>Urgency</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id} onClick={() => setSelected(r)} style={{cursor:'pointer'}} className={`${selected?.id===r.id?'row-selected':''} ${!r.resolved?'urg-unread':''}`}>
                      <td style={{fontWeight:500}}>{r.nature || r.type || '—'}</td>
                      <td>{r.customer_name || r.name || '—'}</td>
                      <td className="text-primary">{r.phone || r.customer_phone || '—'}</td>
                      <td className="mono text-muted" style={{fontSize:'0.72rem'}}>{r.order_number || '—'}</td>
                      <td><span className={`badge ${URGENCY_BADGE[r.urgency_level]||'badge-muted'}`}>{r.urgency_level||'Normal'}</span></td>
                      <td className="text-muted" style={{fontSize:'0.72rem', whiteSpace:'nowrap'}}>
                        {r.created_at ? fmtDateTime(r.created_at, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail */}
        {selected && (
          <div className="urg-admin-detail card">
            <div className="cust-detail-hdr">
              <div style={{flex:1}}>
                <p style={{fontWeight:600,fontSize:'0.88rem'}}>{selected.nature || selected.type}</p>
                <span className={`badge ${URGENCY_BADGE[selected.urgency_level]||'badge-muted'}`}>{selected.urgency_level||'Normal'}</span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            <div className="urg-detail-fields">
              {[
                ['Customer', selected.customer_name || selected.name],
                ['Phone', selected.phone || selected.customer_phone],
                ['Email', selected.email],
                ['Order #', selected.order_number],
                ['Location', selected.location],
              ].filter(([,v]) => v).map(([l,v]) => (
                <div key={l} className="urg-detail-field">
                  <p className="text-muted" style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>{l}</p>
                  {l === 'Phone'
                    ? <a href={`tel:${v}`} className="text-primary" style={{fontSize:'0.88rem',fontWeight:600}}>{v}</a>
                    : <p style={{fontSize:'0.82rem'}}>{v}</p>
                  }
                </div>
              ))}
            </div>

            {selected.message && (
              <div className="urg-message">
                <p className="text-muted" style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.4rem'}}>Message</p>
                <p style={{fontSize:'0.82rem',lineHeight:1.55,whiteSpace:'pre-wrap'}}>{selected.message}</p>
              </div>
            )}

            {(selected.phone || selected.customer_phone) && (
              <a href={`tel:${selected.phone || selected.customer_phone}`} className="btn btn-primary">
                <Phone size={14} /> Call Customer Now
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
