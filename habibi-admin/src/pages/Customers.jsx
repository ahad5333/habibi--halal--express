import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, X, Mail, Phone, MapPin, ShoppingBag, Plus, Pencil, Upload,
  Download, FileSpreadsheet, Check, Trash2, UserPlus, TrendingUp, Star,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import './Customers.css';
import { fmtDate } from '../utils/date.js';

const PAGE_SIZE = 50;
const ROLE_OPTIONS = [
  { value: 'all',      label: 'All Roles' },
  { value: 'customer', label: 'Customer' },
  { value: 'guest',    label: 'Guest (no account)' },
  { value: 'business', label: 'Business' },
  { value: 'merchant', label: 'Merchant' },
];
const CUSTOMER_ROLES = ['customer', 'business', 'merchant'];
const ROLE_BADGE = { guest: 'badge-muted', customer: 'badge-success', business: 'badge-info', merchant: 'badge-warning' };
const BLANK_FORM = { name: '', email: '', phone: '', role: 'customer' };

// Minimal CSV parser — handles quoted fields. Matches name/email/phone headers
// case-insensitively; falls back to column order if there's no header row.
function parseCustomersCsv(text) {
  const parseLine = (line) => {
    const cells = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cur += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === ',') { cells.push(cur); cur = ''; }
      else { cur += c; }
    }
    cells.push(cur);
    return cells.map(c => c.trim());
  };

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  let rows = lines.map(parseLine);
  let nameIdx = 0, emailIdx = 1, phoneIdx = 2;
  const header = rows[0].map(h => h.toLowerCase());
  const hasHeader = header.some(h => ['name', 'email', 'phone'].includes(h));
  if (hasHeader) {
    const ni = header.indexOf('name'), ei = header.indexOf('email'), pi = header.indexOf('phone');
    if (ni !== -1) nameIdx = ni;
    if (ei !== -1) emailIdx = ei;
    if (pi !== -1) phoneIdx = pi;
    rows = rows.slice(1);
  }

  return rows.map(cells => ({
    name:  cells[nameIdx]  || '',
    email: cells[emailIdx] || '',
    phone: cells[phoneIdx] || '',
  })).filter(r => r.email);
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchTimer = useRef(null);

  // Filters
  const [filters, setFilters] = useState({ search: '', role: 'all', dateFrom: '', dateTo: '', minSpent: '', sort: 'created_at', dir: 'desc' });

  // Row selection / bulk actions
  const [checked, setChecked] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Add / Edit modal
  const [modal, setModal]   = useState(null); // null | 'add' | customer object being edited
  const [form, setForm]     = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // CSV bulk import
  const [bulkModal, setBulkModal]         = useState(false);
  const [bulkRows, setBulkRows]           = useState([]);
  const [bulkFileName, setBulkFileName]   = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult]       = useState(null);
  const fileInputRef = useRef(null);

  // Top Customers date-range report
  const [topModal, setTopModal]     = useState(false);
  const [topFrom, setTopFrom]       = useState(daysAgoISO(30));
  const [topTo, setTopTo]           = useState(todayISO());
  const [topSort, setTopSort]       = useState('spent');
  const [topRows, setTopRows]       = useState(null);
  const [topLoading, setTopLoading] = useState(false);

  // Cohorts & Retention report
  const [cohortModal, setCohortModal]     = useState(false);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [cohortErr, setCohortErr]         = useState('');
  const [segments, setSegments]           = useState(null); // { segments, totals }
  const [cohortData, setCohortData]       = useState(null); // { cohorts, activity, months }

  const [exporting, setExporting] = useState(false);

  const load = useCallback((f, p) => {
    setLoading(true);
    adminAPI.customers(f, p, PAGE_SIZE)
      .then(d => { setCustomers(d.customers || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(filters, page); }, [load, page, filters.role, filters.dateFrom, filters.dateTo, filters.minSpent, filters.sort, filters.dir]);

  const updateFilter = (key, value) => {
    setPage(1);
    setChecked(new Set());
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = (e) => {
    const q = e.target.value;
    setFilters(prev => ({ ...prev, search: q }));
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load({ ...filters, search: q }, 1), 350);
  };

  const toggleSort = (col) => {
    setPage(1);
    setFilters(prev => prev.sort === col
      ? { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { ...prev, sort: col, dir: 'desc' });
  };

  const clearFilters = () => {
    setPage(1);
    setChecked(new Set());
    setFilters({ search: '', role: 'all', dateFrom: '', dateTo: '', minSpent: '', sort: 'created_at', dir: 'desc' });
  };

  const openCustomer = async (c) => {
    setSelected(c);
    setDetail(null);
    setDetailLoading(true);
    try { const d = await adminAPI.customer(c.id); setDetail(d); }
    catch (_) { setDetail(c); }
    finally { setDetailLoading(false); }
  };

  const toggleCheck = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const registeredRows = customers.filter(c => !c.is_guest && CUSTOMER_ROLES.includes(c.role));
  const toggleCheckAll = () => {
    setChecked(prev => {
      const allChecked = registeredRows.length > 0 && registeredRows.every(c => prev.has(c.id));
      const next = new Set(prev);
      registeredRows.forEach(c => allChecked ? next.delete(c.id) : next.add(c.id));
      return next;
    });
  };

  const openAdd = (prefill) => { setForm(prefill || BLANK_FORM); setFormErr(''); setModal('add'); };
  const openEdit = (c) => { setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '', role: CUSTOMER_ROLES.includes(c.role) ? c.role : 'customer' }); setFormErr(''); setModal(c); };

  const saveCustomer = async () => {
    if (!form.email.trim()) { setFormErr('Email is required.'); return; }
    setSaving(true); setFormErr('');
    try {
      if (modal === 'add') await adminAPI.createCustomer(form);
      else await adminAPI.updateCustomer(modal.id, form);
      setModal(null);
      load(filters, page);
      if (selected) openCustomer(selected);
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      await adminAPI.bulkDeleteCustomers([...checked]);
      setChecked(new Set());
      setBulkDeleteConfirm(false);
      if (selected && checked.has(selected.id)) setSelected(null);
      load(filters, page);
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const openBulkImport = () => { setBulkRows([]); setBulkFileName(''); setBulkResult(null); setBulkModal(true); };
  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setBulkRows(parseCustomersCsv(String(reader.result || '')));
    reader.readAsText(file);
  };
  const runBulkImport = async () => {
    const valid = bulkRows.filter(r => r.email.trim());
    if (valid.length === 0) return;
    setBulkImporting(true);
    try {
      const result = await adminAPI.bulkImportCustomers(valid);
      setBulkResult(result);
      setBulkRows([]);
      load(filters, page);
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkImporting(false);
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const d = await adminAPI.exportCustomers(filters);
      const rows = (d.customers || []).map(c => [
        c.name || '', c.email, c.phone || '', c.role,
        c.created_at ? fmtDate(c.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        c.total_orders ?? 0, parseFloat(c.total_spent || 0).toFixed(2), c.loyalty_points ?? 0,
      ]);
      downloadCsv(`habibi-customers-${Date.now()}.csv`, ['Name', 'Email', 'Phone', 'Role', 'Joined', 'Orders', 'Total Spent', 'Loyalty Points'], rows);
    } catch (e) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  };

  const runTopReport = async () => {
    setTopLoading(true);
    try {
      const d = await adminAPI.topCustomers(topFrom, topTo, topSort, 100);
      setTopRows(d.customers || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setTopLoading(false);
    }
  };

  const openCohortModal = async () => {
    setCohortModal(true);
    if (segments && cohortData) return; // already loaded this session
    setCohortLoading(true); setCohortErr('');
    try {
      const [s, c] = await Promise.all([adminAPI.customerSegments(), adminAPI.customerCohorts(12)]);
      setSegments(s);
      setCohortData(c);
    } catch (e) {
      setCohortErr(e.message);
    } finally {
      setCohortLoading(false);
    }
  };
  const exportTopReport = () => {
    if (!topRows) return;
    const rows = topRows.map(c => [c.name || '', c.email, c.phone || '', c.role, c.orders_in_range, parseFloat(c.spent_in_range || 0).toFixed(2)]);
    downloadCsv(`habibi-top-customers-${topFrom}-to-${topTo}.csv`, ['Name', 'Email', 'Phone', 'Role', 'Orders', 'Total Spent'], rows);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sortArrow = (col) => filters.sort === col ? (filters.dir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="customers-page">
      <div className="page-hdr">
        <div>
          <p className="page-title">Customers</p>
          <p className="page-sub">{total.toLocaleString()} customers (registered + repeat guests)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => { setTopModal(true); setTopRows(null); }}>
            <TrendingUp size={15} /> Top Customers
          </button>
          <button className="btn btn-secondary" onClick={openCohortModal}>
            <Star size={15} /> Cohorts & Retention
          </button>
          <button className="btn btn-secondary" onClick={runExport} disabled={exporting}>
            {exporting ? <div className="spinner" /> : <><Download size={15} /> Export CSV</>}
          </button>
          <button className="btn btn-secondary" onClick={openBulkImport}>
            <Upload size={15} /> Bulk Import
          </button>
          <button className="btn btn-primary" onClick={() => openAdd()}>
            <Plus size={15} /> Add Customer
          </button>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="card cust-filters">
        <input className="input" style={{ minWidth: 200, flex: 1 }} placeholder="Search name, email, phone…" value={filters.search} onChange={handleSearch} />
        <select className="input select" value={filters.role} onChange={e => updateFilter('role', e.target.value)}>
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="cust-date-range">
          <input className="input" type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} title="Joined from" />
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>to</span>
          <input className="input" type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} title="Joined to" />
        </div>
        <input className="input" style={{ width: 130 }} type="number" min="0" placeholder="Min spent $" value={filters.minSpent} onChange={e => updateFilter('minSpent', e.target.value)} />
        {(filters.role !== 'all' || filters.dateFrom || filters.dateTo || filters.minSpent || filters.search) && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
        )}
      </div>

      {/* Bulk action bar */}
      {checked.size > 0 && (
        <div className="card" style={{
          padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.5rem', borderLeft: '3px solid var(--color-primary)',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{checked.size} selected</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-danger btn-sm" disabled={bulkActionLoading} onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 size={13} /> Remove
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set())}>Clear</button>
          </div>
        </div>
      )}

      <div className="customers-layout">
        {/* List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
          {loading ? (
            <div className="empty"><div className="spinner" /></div>
          ) : customers.length === 0 ? (
            <div className="empty"><Users size={36} /><p>No customers found</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input type="checkbox" checked={registeredRows.length > 0 && registeredRows.every(c => checked.has(c.id))} onChange={toggleCheckAll} />
                    </th>
                    <th className="cust-sortable" onClick={() => toggleSort('name')}>Customer{sortArrow('name')}</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th className="cust-sortable" onClick={() => toggleSort('created_at')}>Joined{sortArrow('created_at')}</th>
                    <th className="cust-sortable" onClick={() => toggleSort('total_orders')}>Orders{sortArrow('total_orders')}</th>
                    <th className="cust-sortable" onClick={() => toggleSort('total_spent')}>Total Spent{sortArrow('total_spent')}</th>
                    <th>Role</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} onClick={() => openCustomer(c)} style={{ cursor: 'pointer' }} className={selected?.id === c.id ? 'row-selected' : ''}>
                      <td onClick={e => e.stopPropagation()}>
                        {!c.is_guest && CUSTOMER_ROLES.includes(c.role) && <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggleCheck(c.id)} />}
                      </td>
                      <td>
                        <div className="cust-name-cell">
                          <div className="cust-avatar">{(c.name || '?').charAt(0).toUpperCase()}</div>
                          <span style={{ fontWeight: 500 }}>{c.name || '—'}</span>
                        </div>
                      </td>
                      <td className="text-muted">{c.email}</td>
                      <td className="text-muted">{c.phone || '—'}</td>
                      <td className="text-muted" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {c.created_at ? fmtDate(c.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-muted">{c.total_orders ?? 0}</span></td>
                      <td style={{ fontWeight: 500, color: 'var(--color-primary)' }}>${parseFloat(c.total_spent || 0).toFixed(2)}</td>
                      <td><span className={`badge ${ROLE_BADGE[c.role] || 'badge-muted'}`}>{c.role}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        {c.is_guest ? (
                          <button className="btn btn-ghost btn-sm" title="Create a login account for this guest" onClick={() => openAdd({ name: c.name || '', email: c.email || '', phone: c.phone || '', role: 'customer' })}>
                            <UserPlus size={13} /> Create Account
                          </button>
                        ) : CUSTOMER_ROLES.includes(c.role) ? (
                          <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
              <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Page {page} of {totalPages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="cust-detail card">
            <div className="cust-detail-hdr">
              <div className="cust-detail-avatar">{(selected.name || '?').charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selected.name || '—'}</p>
                <p className="text-muted" style={{ fontSize: '0.72rem' }}>{selected.role}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            {detailLoading ? <div className="empty" style={{ minHeight: 100 }}><div className="spinner" /></div> : (
              <>
                {(detail || selected).is_guest && (
                  <div className="cust-guest-note">
                    <span>No account — repeat guest checkout only</span>
                    <button className="btn btn-primary btn-sm" onClick={() => openAdd({ name: (detail || selected).name || '', email: (detail || selected).email || '', phone: (detail || selected).phone || '', role: 'customer' })}>
                      <UserPlus size={13} /> Create Account
                    </button>
                  </div>
                )}
                <div className="cust-detail-fields">
                  <div className="cust-detail-field"><Mail size={13} /><span>{(detail || selected).email}</span></div>
                  <div className="cust-detail-field"><Phone size={13} /><span>{(detail || selected).phone || '—'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <div className="cust-stat-box">
                    <p className="cust-stat-label">ORDERS</p>
                    <p className="cust-stat-num">{(detail || selected).total_orders ?? selected.total_orders ?? 0}</p>
                  </div>
                  <div className="cust-stat-box">
                    <p className="cust-stat-label">TOTAL SPENT</p>
                    <p className="cust-stat-num" style={{ color: 'var(--color-primary)' }}>${parseFloat((detail || selected).total_spent ?? selected.total_spent ?? 0).toFixed(2)}</p>
                  </div>
                  {!(detail || selected).is_guest && (
                    <div className="cust-stat-box">
                      <p className="cust-stat-label"><Star size={10} style={{ verticalAlign: -1 }} /> LOYALTY</p>
                      <p className="cust-stat-num">{(detail || selected).loyalty_points ?? 0}</p>
                    </div>
                  )}
                </div>

                {detail?.addresses?.length > 0 && (
                  <div className="cust-detail-section">
                    <p className="cust-detail-label">ADDRESSES</p>
                    {detail.addresses.map((a, i) => (
                      <div key={i} className="cust-detail-addr"><MapPin size={12} /><span>{a.street}, {a.city}</span></div>
                    ))}
                  </div>
                )}

                {detail?.orders?.length > 0 && (
                  <div className="cust-detail-section">
                    <p className="cust-detail-label">RECENT ORDERS ({detail.orders.length})</p>
                    {detail.orders.slice(0, 5).map((o, i) => (
                      <div key={i} className="cust-detail-order">
                        <ShoppingBag size={12} />
                        <span className="mono text-primary" style={{ fontSize: '0.72rem' }}>{o.order_number || o.id}</span>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>${parseFloat(o.total || 0).toFixed(2)}</span>
                        <span className={`badge ${(o.order_status || o.status) === 'delivered' ? 'badge-success' : 'badge-warning'}`}>{o.order_status || o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">{modal === 'add' ? 'Add Customer' : 'Edit Customer'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {formErr && <p className="text-error" style={{ marginBottom: '0.75rem' }}>{formErr}</p>}
              <div className="cust-form-grid">
                <div className="field">
                  <label>Name</label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </div>
                <div className="field">
                  <label>Role</label>
                  <select className="input select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {CUSTOMER_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Email *</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="customer@email.com" />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (718) 555-0000" />
                </div>
              </div>
              {modal === 'add' && (
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                  A "set your password" email will be sent to this address automatically.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCustomer} disabled={saving || !form.email.trim()}>
                {saving ? <div className="spinner" /> : <><Check size={14} /> {modal === 'add' ? 'Add' : 'Save'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Remove {checked.size} Customer{checked.size !== 1 ? 's' : ''}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setBulkDeleteConfirm(false)}><X size={16} /></button>
            </div>
            <p style={{ marginBottom: '1.5rem' }}>
              Remove {checked.size} selected customer account{checked.size !== 1 ? 's' : ''}? This deletes their login and cannot be undone. Their past order records are kept.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setBulkDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={runBulkDelete} disabled={bulkActionLoading}>
                {bulkActionLoading ? <div className="spinner" /> : 'Remove All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkModal && (
        <div className="modal-overlay" onClick={() => setBulkModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Bulk Import Customers</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setBulkModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {bulkResult ? (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    ✓ {bulkResult.created_count} customer{bulkResult.created_count !== 1 ? 's' : ''} added
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                    Each new account was emailed a link to set their own password.
                  </p>
                  {bulkResult.skipped_count > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--color-danger, #e5484d)', marginBottom: '0.4rem' }}>
                        {bulkResult.skipped_count} skipped
                      </p>
                      <div className="table-wrap">
                        <table className="table">
                          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Reason</th></tr></thead>
                          <tbody>
                            {bulkResult.skipped.map((s, i) => (
                              <tr key={i}>
                                <td>{s.name || '—'}</td>
                                <td>{s.email || '—'}</td>
                                <td>{s.phone || '—'}</td>
                                <td className="text-muted">{s.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    Upload a CSV with <code>name</code>, <code>email</code>, and <code>phone</code> columns
                    (header row optional — email is required per row). Each new customer is created with a
                    random password and emailed a link to set their own before first login.
                  </p>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCsvFile} />
                  <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet size={14} /> {bulkFileName || 'Choose CSV file…'}
                  </button>

                  {bulkRows.length > 0 && (
                    <div className="table-wrap" style={{ marginTop: '1rem', maxHeight: 260, overflowY: 'auto' }}>
                      <table className="table">
                        <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
                        <tbody>
                          {bulkRows.map((r, i) => (
                            <tr key={i} style={!r.email.trim() ? { opacity: 0.5 } : undefined}>
                              <td>{r.name || '—'}</td>
                              <td>{r.email || <em>missing email</em>}</td>
                              <td>{r.phone || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {bulkResult ? (
                <button className="btn btn-primary" onClick={() => setBulkModal(false)}>Done</button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setBulkModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={runBulkImport} disabled={bulkImporting || bulkRows.filter(r => r.email.trim()).length === 0}>
                    {bulkImporting ? <div className="spinner" /> : <><Check size={14} /> Import {bulkRows.filter(r => r.email.trim()).length || ''} Customers</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Customers Report Modal */}
      {topModal && (
        <div className="modal-overlay" onClick={() => setTopModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Top Customers by Date Range</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setTopModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="cust-top-controls">
                <div className="field">
                  <label>From</label>
                  <input className="input" type="date" value={topFrom} onChange={e => setTopFrom(e.target.value)} />
                </div>
                <div className="field">
                  <label>To</label>
                  <input className="input" type="date" value={topTo} onChange={e => setTopTo(e.target.value)} />
                </div>
                <div className="field">
                  <label>Rank by</label>
                  <select className="input select" value={topSort} onChange={e => setTopSort(e.target.value)}>
                    <option value="spent">Total Spent</option>
                    <option value="orders">Order Count</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={runTopReport} disabled={topLoading || !topFrom || !topTo}>
                  {topLoading ? <div className="spinner" /> : 'Run Report'}
                </button>
              </div>

              {topRows !== null && (
                topRows.length === 0 ? (
                  <div className="empty" style={{ minHeight: 100 }}><p>No orders in this range</p></div>
                ) : (
                  <>
                    <div className="table-wrap" style={{ marginTop: '1rem', maxHeight: 360, overflowY: 'auto' }}>
                      <table className="table">
                        <thead><tr><th>#</th><th>Customer</th><th>Email</th><th>Orders</th><th>Spent</th><th>Role</th></tr></thead>
                        <tbody>
                          {topRows.map((c, i) => (
                            <tr key={c.id}>
                              <td className="text-muted">{i + 1}</td>
                              <td style={{ fontWeight: 500 }}>{c.name || '—'}</td>
                              <td className="text-muted">{c.email}</td>
                              <td style={{ textAlign: 'center' }}><span className="badge badge-muted">{c.orders_in_range}</span></td>
                              <td style={{ fontWeight: 500, color: 'var(--color-primary)' }}>${parseFloat(c.spent_in_range || 0).toFixed(2)}</td>
                              <td><span className={`badge ${ROLE_BADGE[c.role] || 'badge-muted'}`}>{c.role}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={exportTopReport}>
                      <Download size={14} /> Export This Report as CSV
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cohorts & Retention Modal */}
      {cohortModal && (
        <div className="modal-overlay" onClick={() => setCohortModal(false)}>
          <div className="modal" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Customer Cohorts &amp; Retention</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setCohortModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {cohortLoading && <div className="empty" style={{ minHeight: 100 }}><div className="spinner" /></div>}
              {cohortErr && <p className="text-error">{cohortErr}</p>}

              {segments && cohortData && !cohortLoading && (
                <>
                  {/* Summary stats */}
                  <div className="cust-cohort-stats">
                    <div className="cust-stat-box">
                      <p className="cust-stat-label">Total Customers</p>
                      <p className="cust-stat-num">{(segments.totals.total_customers || 0).toLocaleString()}</p>
                    </div>
                    <div className="cust-stat-box">
                      <p className="cust-stat-label">Repeat Rate</p>
                      <p className="cust-stat-num">
                        {segments.totals.total_customers > 0
                          ? Math.round((segments.totals.repeat_customers / segments.totals.total_customers) * 100)
                          : 0}%
                      </p>
                    </div>
                    <div className="cust-stat-box">
                      <p className="cust-stat-label">Avg. Lifetime Value</p>
                      <p className="cust-stat-num" style={{ color: 'var(--color-primary)' }}>${parseFloat(segments.totals.avg_ltv || 0).toFixed(2)}</p>
                    </div>
                    <div className="cust-stat-box">
                      <p className="cust-stat-label">Avg. LTV (Repeat)</p>
                      <p className="cust-stat-num" style={{ color: 'var(--color-primary)' }}>${parseFloat(segments.totals.avg_ltv_repeat || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Segmentation by order count */}
                  <p className="cust-cohort-subhdr">Customers by Order Count</p>
                  <div className="cust-segment-list">
                    {['1', '2-3', '4-9', '10+'].map(bucket => {
                      const row = segments.segments.find(s => s.bucket === bucket);
                      const count = row ? row.customer_count : 0;
                      const revenue = row ? parseFloat(row.bucket_revenue || 0) : 0;
                      const maxCount = Math.max(1, ...segments.segments.map(s => s.customer_count));
                      return (
                        <div key={bucket} className="cust-segment-row">
                          <span className="cust-segment-label">{bucket} order{bucket === '1' ? '' : 's'}</span>
                          <div className="cust-segment-bar-wrap">
                            <div className="cust-segment-bar" style={{ width: `${(count / maxCount) * 120}px` }} />
                            <span>{count.toLocaleString()} customers · ${revenue.toFixed(0)} revenue</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cohort retention heatmap */}
                  <p className="cust-cohort-subhdr">Retention by First-Order Month</p>
                  <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
                    Each row is a group of customers by the month they first ordered. Each column is % of that group who ordered again N months later.
                  </p>
                  {cohortData.cohorts.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.82rem' }}>Not enough order history yet to show cohorts.</p>
                  ) : (() => {
                    const activityMap = {};
                    let maxIndex = 0;
                    cohortData.activity.forEach(a => {
                      activityMap[`${a.cohort_month}-${a.month_index}`] = a.active_customers;
                      if (a.month_index > maxIndex) maxIndex = a.month_index;
                    });
                    const fmtCohortMonth = (m) => new Date(m).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                    return (
                      <div className="cust-cohort-heatmap-wrap">
                        <table className="cust-cohort-heatmap">
                          <thead>
                            <tr>
                              <th>Cohort</th>
                              <th>Size</th>
                              {Array.from({ length: maxIndex + 1 }).map((_, i) => <th key={i}>M{i}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {cohortData.cohorts.map(c => (
                              <tr key={c.cohort_month}>
                                <td className="cust-cohort-month">{fmtCohortMonth(c.cohort_month)}</td>
                                <td className="text-muted">{c.cohort_size}</td>
                                {Array.from({ length: maxIndex + 1 }).map((_, i) => {
                                  const active = activityMap[`${c.cohort_month}-${i}`];
                                  const pct = active != null ? Math.round((active / c.cohort_size) * 100) : null;
                                  return (
                                    <td key={i}>
                                      {pct != null && (
                                        <span
                                          className="cust-cohort-cell"
                                          style={{ background: `rgba(249,115,22,${Math.max(0.08, pct / 100)})` }}
                                        >{pct}%</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
