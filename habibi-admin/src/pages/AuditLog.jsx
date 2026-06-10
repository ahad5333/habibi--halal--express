import React, { useState, useEffect, useCallback } from 'react';
import { Shield, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { adminAPI } from '../services/api';
import './AuditLog.css';
import { fmtDate, fmtDateShort, fmtTime, fmtDateTime } from '../utils/date.js';

const ENTITY_TYPES = [
  '', 'menu_item', 'coupon', 'order', 'user', 'location', 'staff',
  'partner', 'inventory', 'broadcast', 'setting',
];

const PAGE_SIZE = 50;

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function actionBadge(action) {
  const a = (action || '').toLowerCase();
  if (a.includes('delete') || a.includes('remove')) return 'badge-error';
  if (a.includes('create') || a.includes('add'))    return 'badge-success';
  if (a.includes('update') || a.includes('edit'))   return 'badge-info';
  return 'badge-muted';
}

export default function AuditLog() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage]           = useState(0);
  const [expanded, setExpanded]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        limit:  PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(entityType ? { entity_type: entityType } : {}),
      });
      const data = await adminAPI.getAuditLog(`?${params}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }, [page, entityType]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (type) => { setEntityType(type); setPage(0); };

  return (
    <div className="audit-page">
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-sub">Full record of admin actions on this system</p>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={load} title="Refresh">
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="audit-filters">
        {ENTITY_TYPES.map(t => (
          <button
            key={t}
            className={`audit-filter-btn${entityType === t ? ' active' : ''}`}
            onClick={() => handleFilter(t)}
          >
            {t || 'All'}
          </button>
        ))}
      </div>

      {error && <div className="audit-error">⚠ {error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <Shield size={36} />
            <p>No audit entries{entityType ? ` for "${entityType}"` : ''} yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>ID</th>
                  <th>IP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <React.Fragment key={r.id}>
                    <tr
                      className={`audit-row${expanded === r.id ? ' expanded' : ''}`}
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <td className="audit-ts text-muted">{fmt(r.created_at)}</td>
                      <td style={{ fontWeight: 600 }}>{r.admin_name || '—'}</td>
                      <td>
                        <span className={`badge ${actionBadge(r.action)}`}>
                          {r.action}
                        </span>
                      </td>
                      <td className="text-muted">{r.entity_type || '—'}</td>
                      <td className="mono text-muted" style={{ fontSize: '0.72rem' }}>{r.entity_id || '—'}</td>
                      <td className="mono text-muted" style={{ fontSize: '0.72rem' }}>{r.ip_address || '—'}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                        {r.details && Object.keys(r.details).length > 0 ? '▾ details' : ''}
                      </td>
                    </tr>
                    {expanded === r.id && r.details && Object.keys(r.details).length > 0 && (
                      <tr className="audit-details-row">
                        <td colSpan={7}>
                          <pre className="audit-details-json">
                            {JSON.stringify(r.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && (rows.length === PAGE_SIZE || page > 0) && (
        <div className="audit-pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Page {page + 1}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={rows.length < PAGE_SIZE}
            onClick={() => setPage(p => p + 1)}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
