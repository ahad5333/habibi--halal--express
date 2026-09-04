import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ShoppingBag } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Subscriptions.css';

const STATUS_TABS = [
  { id: '',          label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'paused',    label: 'Paused' },
  { id: 'cancelled', label: 'Cancelled' },
];
const STATUS_BADGE = { active: 'badge-success', paused: 'badge-warning', cancelled: 'badge-muted' };

export default function Subscriptions() {
  const [status, setStatus]   = useState('');
  const [subs, setSubs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminAPI.subscriptions(status);
      setSubs(Array.isArray(data) ? data : []);
    } catch (_) { setSubs([]); }
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      const updated = action === 'pause' ? await adminAPI.pauseSubscription(id) : await adminAPI.cancelSubscription(id);
      setSubs(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
    } catch (e) { alert(e.message); }
    setBusyId(null);
  };

  return (
    <div>
      <div className="page-hdr">
        <div>
          <p className="page-title"><RefreshCw size={20} style={{ verticalAlign: -3, marginRight: 6 }} />Subscriptions</p>
          <p className="page-sub">Habibi Weekly — recurring orders, view + pause/cancel on a customer's behalf</p>
        </div>
      </div>

      <div className="card sub-filters">
        {STATUS_TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${status === t.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatus(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty" style={{ minHeight: 160 }}><div className="spinner" /></div>
        ) : subs.length === 0 ? (
          <div className="empty" style={{ minHeight: 160 }}>
            <ShoppingBag size={32} />
            <p>No subscriptions{status ? ` with status "${status}"` : ''} yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Frequency</th>
                  <th>Next Charge</th>
                  <th>Card</th>
                  <th>Failed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => {
                  const items = Array.isArray(s.items) ? s.items : [];
                  const itemsSummary = items.map(i => `${i.qty || i.quantity || 1}× ${i.name}`).join(', ');
                  return (
                    <tr key={s.id}>
                      <td>
                        <p style={{ fontWeight: 500 }}>{s.customer_name}</p>
                        <p className="text-muted" style={{ fontSize: '0.7rem' }}>{s.customer_email}</p>
                      </td>
                      <td className="text-muted" style={{ maxWidth: 260 }}>{itemsSummary}</td>
                      <td className="text-muted">Every {s.interval_days}d</td>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                        {s.status === 'active' ? new Date(s.next_charge_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="text-muted">{s.card_last4 ? `${s.card_brand || 'Card'} •••• ${s.card_last4}` : '—'}</td>
                      <td>{s.failed_attempts > 0 ? <span className="badge badge-error">{s.failed_attempts}/3</span> : '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-muted'}`}>{s.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {s.status === 'active' && (
                            <button className="btn btn-secondary btn-sm" disabled={busyId === s.id} onClick={() => act(s.id, 'pause')}>Pause</button>
                          )}
                          {s.status !== 'cancelled' && (
                            <button className="btn btn-secondary btn-sm" disabled={busyId === s.id} onClick={() => act(s.id, 'cancel')}>Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
