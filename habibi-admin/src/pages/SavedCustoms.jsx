import React, { useState, useEffect } from 'react';
import { Bookmark, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { adminAPI } from '../services/api';
import './SavedCustoms.css';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ConfigDetails({ config }) {
  if (!config) return <span className="text-muted">—</span>;
  const entries = typeof config === 'object' ? Object.entries(config) : [];
  if (!entries.length) return <span className="text-muted">Empty</span>;
  return (
    <div className="sc-config">
      {entries.map(([k, v]) => (
        <span key={k} className="sc-config-tag">
          <strong>{k}:</strong> {String(v).slice(0, 40)}
        </span>
      ))}
    </div>
  );
}

function Row({ row }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="sc-row" onClick={() => setOpen(o => !o)}>
        <td>
          <p className="fw-med">{row.name}</p>
        </td>
        <td>
          <p className="fw-med">{row.user_name || '—'}</p>
          <p className="text-muted text-sm">{row.user_email || ''}</p>
        </td>
        <td>{fmt(row.created_at)}</td>
        <td>
          <button className="sc-expand-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="sc-detail-row">
          <td colSpan={4}>
            <ConfigDetails config={row.config} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function SavedCustoms() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    adminAPI.getSavedCustoms()
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const visible = q
    ? rows.filter(r =>
        (r.name       || '').toLowerCase().includes(q) ||
        (r.user_name  || '').toLowerCase().includes(q) ||
        (r.user_email || '').toLowerCase().includes(q)
      )
    : rows;

  return (
    <div className="sc-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Saved Custom Orders</p>
          <p className="page-sub">{rows.length} saved builds across all customers</p>
        </div>
        <div className="sc-search">
          <Search size={14} />
          <input
            className="input"
            placeholder="Search name, customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div className="empty"><Bookmark size={36} /><p>No saved custom orders found</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Custom Order Name</th>
                  <th>Customer</th>
                  <th>Saved On</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => <Row key={r.id} row={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
