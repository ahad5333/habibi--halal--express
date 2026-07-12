import React, { useState, useEffect } from 'react';
import { Users, ShoppingCart, Clock, CheckCircle, Search } from 'lucide-react';
import { adminAPI } from '../services/api';
import './GroupOrders.css';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GroupOrders() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    adminAPI.getGroupOrders()
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const visible = q
    ? rows.filter(r =>
        (r.host_name  || '').toLowerCase().includes(q) ||
        (r.host_email || '').toLowerCase().includes(q) ||
        (r.join_code  || '').toLowerCase().includes(q) ||
        (r.session_id || '').toLowerCase().includes(q)
      )
    : rows;

  const totals = {
    total:  rows.length,
    open:   rows.filter(r => r.status === 'open').length,
    closed: rows.filter(r => r.status === 'closed').length,
    value:  rows.reduce((s, r) => s + parseFloat(r.total_value || 0), 0),
  };

  return (
    <div className="go-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Group Orders</p>
          <p className="page-sub">{rows.length} sessions recorded</p>
        </div>
        <div className="go-search">
          <Search size={14} />
          <input
            className="input"
            placeholder="Search host, code, session ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="go-stats">
        <div className="stat-card">
          <Users size={20} className="stat-icon" />
          <div>
            <p className="stat-val">{totals.total}</p>
            <p className="stat-label">Total Sessions</p>
          </div>
        </div>
        <div className="stat-card">
          <Clock size={20} className="stat-icon stat-icon--yellow" />
          <div>
            <p className="stat-val">{totals.open}</p>
            <p className="stat-label">Open</p>
          </div>
        </div>
        <div className="stat-card">
          <CheckCircle size={20} className="stat-icon stat-icon--green" />
          <div>
            <p className="stat-val">{totals.closed}</p>
            <p className="stat-label">Closed</p>
          </div>
        </div>
        <div className="stat-card">
          <ShoppingCart size={20} className="stat-icon stat-icon--gold" />
          <div>
            <p className="stat-val">${totals.value.toFixed(2)}</p>
            <p className="stat-label">Total Cart Value</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div className="empty"><Users size={36} /><p>No group sessions found</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Join Code</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Participants</th>
                  <th>Items</th>
                  <th>Cart Value</th>
                  <th>Created</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.session_id}>
                    <td><code className="go-code">{r.join_code}</code></td>
                    <td>
                      <p className="fw-med">{r.host_name || '—'}</p>
                      <p className="text-muted text-sm">{r.host_email || ''}</p>
                    </td>
                    <td>
                      <span className={r.status === 'open' ? 'badge badge--green' : 'badge badge--gray'}>
                        {r.status}
                      </span>
                    </td>
                    <td className="text-center">{r.participant_count || 0}</td>
                    <td className="text-center">{r.item_count || 0}</td>
                    <td>${parseFloat(r.total_value || 0).toFixed(2)}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>
                      <span className={new Date(r.expires_at) < new Date() ? 'text-muted' : ''}>
                        {fmt(r.expires_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
