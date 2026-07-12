import React, { useState, useEffect } from 'react';
import { Users, Gift, CheckCircle, Clock, Search } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Referrals.css';

const STATUS_COLORS = {
  completed: 'badge badge--green',
  pending:   'badge badge--yellow',
  expired:   'badge badge--gray',
};

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Referrals() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    adminAPI.getReferrals()
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const visible = q
    ? rows.filter(r =>
        (r.referrer_name  || '').toLowerCase().includes(q) ||
        (r.referrer_email || '').toLowerCase().includes(q) ||
        (r.referee_name   || '').toLowerCase().includes(q) ||
        (r.referee_email  || '').toLowerCase().includes(q) ||
        (r.referral_code  || '').toLowerCase().includes(q)
      )
    : rows;

  const totals = {
    total:     rows.length,
    completed: rows.filter(r => r.status === 'completed').length,
    points:    rows.reduce((s, r) => s + (parseInt(r.points_awarded) || 0), 0),
  };

  return (
    <div className="referrals-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Referral Program</p>
          <p className="page-sub">{rows.length} referrals recorded</p>
        </div>
        <div className="referrals-search">
          <Search size={14} />
          <input
            className="input"
            placeholder="Search name, email, code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="referrals-stats">
        <div className="stat-card">
          <Users size={20} className="stat-icon" />
          <div>
            <p className="stat-val">{totals.total}</p>
            <p className="stat-label">Total Referrals</p>
          </div>
        </div>
        <div className="stat-card">
          <CheckCircle size={20} className="stat-icon stat-icon--green" />
          <div>
            <p className="stat-val">{totals.completed}</p>
            <p className="stat-label">Completed</p>
          </div>
        </div>
        <div className="stat-card">
          <Gift size={20} className="stat-icon stat-icon--gold" />
          <div>
            <p className="stat-val">{totals.points.toLocaleString()}</p>
            <p className="stat-label">Points Awarded</p>
          </div>
        </div>
        <div className="stat-card">
          <Clock size={20} className="stat-icon stat-icon--yellow" />
          <div>
            <p className="stat-val">{totals.total - totals.completed}</p>
            <p className="stat-label">Pending</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div className="empty"><Gift size={36} /><p>No referrals found</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Referrer</th>
                  <th>Referee</th>
                  <th>Status</th>
                  <th>Points</th>
                  <th>Referred</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.id}>
                    <td><code className="referrals-code">{r.referral_code}</code></td>
                    <td>
                      <p className="fw-med">{r.referrer_name || '—'}</p>
                      <p className="text-muted text-sm">{r.referrer_email || ''}</p>
                    </td>
                    <td>
                      <p className="fw-med">{r.referee_name || r.referee_email || '—'}</p>
                      {r.referee_name && <p className="text-muted text-sm">{r.referee_email || ''}</p>}
                    </td>
                    <td>
                      <span className={STATUS_COLORS[r.status] || 'badge badge--gray'}>
                        {r.status || 'pending'}
                      </span>
                    </td>
                    <td>{r.points_awarded ? <strong>{r.points_awarded}</strong> : '—'}</td>
                    <td>{fmt(r.created_at)}</td>
                    <td>{fmt(r.completed_at)}</td>
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
