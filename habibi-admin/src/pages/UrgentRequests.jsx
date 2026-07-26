import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Phone, RefreshCw, X, Bell, CheckCircle2, RotateCcw } from 'lucide-react';
import { adminAPI } from '../services/api';
import './UrgentRequests.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';
import {
  unlockAudio, startContinuousRing, stopContinuousRing, playBell,
  showNewOrderNotification,
} from '../utils/orderAlerts';

const URGENCY_BADGE = { High:'badge-error', Normal:'badge-warning', Low:'badge-muted' };

export default function UrgentRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [soundOn, setSoundOn]   = useState(() => localStorage.getItem('habibi_sound_on') === '1');
  const knownIds = useRef(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return () => stopContinuousRing();
  }, []);

  const handleEnableSound = () => {
    unlockAudio();
    setSoundOn(true);
    localStorage.setItem('habibi_sound_on', '1');
    setTimeout(playBell, 100);
  };

  const fetch = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    adminAPI.urgent()
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setRequests(list);

        const open = list.filter(r => r.status !== 'resolved');
        if (knownIds.current !== null) {
          const incoming = open.filter(r => !knownIds.current.has(r.id));
          if (incoming.length > 0) showNewOrderNotification(incoming.length);
        }
        knownIds.current = new Set(open.map(r => r.id));
        if (open.length > 0) startContinuousRing(); else stopContinuousRing();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Urgent reports carry 5–15 minute SLA promises to the customer — poll
  // tighter than the general Orders page (30s) so nothing sits unnoticed.
  useEffect(() => {
    const t = setInterval(() => fetch(true), 20000);
    return () => clearInterval(t);
  }, [fetch]);

  const setStatus = async (id, status) => {
    setUpdating(true);
    try {
      const updated = await adminAPI.updateUrgentStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      setSelected(prev => (prev && prev.id === id) ? updated : prev);
    } catch (err) {
      alert(`Failed to update request: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const unread = requests.filter(r => r.status !== 'resolved').length;

  return (
    <div className="urgent-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Urgent Requests</p>
          <p className="page-sub">{unread} unresolved · {requests.length} total</p>
        </div>
        <div style={{display:'flex', gap:'0.5rem'}}>
          <button
            className={`btn btn-sm ${soundOn ? 'btn-success' : 'btn-warning'}`}
            onClick={soundOn ? playBell : handleEnableSound}
            title={soundOn ? 'Sound enabled — click to test bell' : 'Click to enable new-request bell alerts'}
            style={{gap:'0.4rem'}}
          >
            <Bell size={14}/> {soundOn ? 'Sound On' : 'Enable Sound'}
          </button>
          <button className="btn btn-secondary" onClick={() => fetch()}><RefreshCw size={14} /> Refresh</button>
        </div>
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
                  <tr><th>Type</th><th>Customer</th><th>Phone</th><th>Order</th><th>Urgency</th><th>Status</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id} onClick={() => setSelected(r)} style={{cursor:'pointer'}} className={`${selected?.id===r.id?'row-selected':''} ${r.status!=='resolved'?'urg-unread':''}`}>
                      <td style={{fontWeight:500}}>{r.reason || '—'}</td>
                      <td>{r.name || '—'}</td>
                      <td className="text-primary">{r.phone || '—'}</td>
                      <td className="mono text-muted" style={{fontSize:'0.72rem'}}>{r.order_id || '—'}</td>
                      <td><span className={`badge ${URGENCY_BADGE[r.urgency_level]||'badge-muted'}`}>{r.urgency_level||'Normal'}</span></td>
                      <td>
                        <span className={`badge ${r.status==='resolved' ? 'badge-success' : 'badge-warning'}`}>
                          {r.status==='resolved' ? 'Resolved' : 'Open'}
                        </span>
                      </td>
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
                <p style={{fontWeight:600,fontSize:'0.88rem'}}>{selected.reason || 'Urgent Request'}</p>
                <span className={`badge ${URGENCY_BADGE[selected.urgency_level]||'badge-muted'}`}>{selected.urgency_level||'Normal'}</span>
                {' '}
                <span className={`badge ${selected.status==='resolved' ? 'badge-success' : 'badge-warning'}`}>
                  {selected.status==='resolved' ? 'Resolved' : 'Open'}
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            <div className="urg-detail-fields">
              {[
                ['Customer', selected.name],
                ['Phone', selected.phone],
                ['Email', selected.email],
                ['Order #', selected.order_id],
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

            <div style={{display:'flex', gap:'0.5rem', marginTop:'0.5rem'}}>
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="btn btn-primary" style={{flex:1}}>
                  <Phone size={14} /> Call Customer Now
                </a>
              )}
              {selected.status === 'resolved' ? (
                <button className="btn btn-secondary" onClick={() => setStatus(selected.id, 'open')} disabled={updating}>
                  <RotateCcw size={14} /> Reopen
                </button>
              ) : (
                <button className="btn btn-success" onClick={() => setStatus(selected.id, 'resolved')} disabled={updating}>
                  <CheckCircle2 size={14} /> Mark Resolved
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
