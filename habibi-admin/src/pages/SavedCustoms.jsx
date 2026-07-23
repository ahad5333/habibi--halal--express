import React, { useState, useEffect } from 'react';
import { Bookmark, ChevronDown, ChevronUp, Search, Trash2 } from 'lucide-react';
import { adminAPI } from '../services/api';
import './SavedCustoms.css';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// The saved config's shape (from CustomOrder.jsx's INIT) is mostly nested
// objects — base is a full ingredient record, cheese is {type,qty}, and
// vegetables/proteins/sauces/extras/drinks are all keyed by ingredient ID.
// Naively stringifying any of that produced "[object Object]" for 6 of the
// 9 fields. This renders each shape human-readably instead; ingredient IDs
// aren't resolved to names since the admin page has no live catalog to
// cross-reference against.
function formatConfigField(key, value) {
  if (value === null || value === undefined || value === '') return null;

  if (key === 'base') {
    if (typeof value === 'object') return value.name || `Base #${value.id ?? '?'}`;
    return String(value);
  }

  if (typeof value !== 'object') return String(value);

  if (Array.isArray(value)) {
    return value.length ? value.map(v => (typeof v === 'object' ? (v.name || JSON.stringify(v)) : String(v))).join(', ') : null;
  }

  const entries = Object.entries(value);
  if (!entries.length) return null;

  // cheese: { type, qty } — a single flat object, not a keyed collection
  if (key === 'cheese') {
    if (!value.type || value.type === 'none') return null;
    return value.qty && value.qty !== 'regular' ? `${value.type} (${value.qty})` : value.type;
  }

  // vegetables/proteins/sauces/extras/drinks: keyed by ingredient ID
  return entries.map(([id, detail]) => {
    if (detail === null || typeof detail !== 'object') return `#${id}${detail ? ` ×${detail}` : ''}`;
    const bits = [];
    if (detail.qty && detail.qty !== 'regular') bits.push(detail.qty);
    if (detail.count && detail.count !== 1) bits.push(`×${detail.count}`);
    if (detail.placement && detail.placement !== 'on_food') bits.push(detail.placement.replace('_', ' '));
    return `#${id}${bits.length ? ` (${bits.join(', ')})` : ''}`;
  }).join(', ');
}

function ConfigDetails({ config }) {
  if (!config) return <span className="text-muted">—</span>;
  const entries = (typeof config === 'object' ? Object.entries(config) : [])
    .map(([k, v]) => [k, formatConfigField(k, v)])
    .filter(([, v]) => v != null);
  if (!entries.length) return <span className="text-muted">Empty</span>;
  return (
    <div className="sc-config">
      {entries.map(([k, v]) => (
        <span key={k} className="sc-config-tag" title={v}>
          <strong>{k}:</strong> {v}
        </span>
      ))}
    </div>
  );
}

function Row({ row, onDelete }) {
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
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
            <button
              className="sc-expand-btn"
              title="Delete"
              onClick={e => { e.stopPropagation(); onDelete(row); }}
            >
              <Trash2 size={14} />
            </button>
            <button className="sc-expand-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
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

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.name}" (saved by ${row.user_name || row.user_email})? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteSavedCustom(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

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
                {visible.map(r => <Row key={r.id} row={r} onDelete={handleDelete} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
