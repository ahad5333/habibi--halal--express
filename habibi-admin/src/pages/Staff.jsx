import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, Plus, Pencil, Trash2, X, Check, Clock, Smartphone, KeyRound, Upload, Download, FileSpreadsheet, UserCheck, UserX } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Staff.css';

const ROLES = ['kitchen', 'delivery', 'manager', 'cashier', 'server'];
const ROLE_COLOR = {
  kitchen:  'badge-warning',
  delivery: 'badge-info',
  manager:  'badge-primary',
  cashier:  'badge-success',
  server:   'badge-muted',
};

const BLANK = { name: '', email: '', phone: '', role: 'kitchen', shift_start: '', shift_end: '', notes: '', is_active: true };

// Minimal CSV parser — handles quoted fields. Matches name/phone/email/role
// headers case-insensitively; falls back to column order if there's no
// recognizable header row. Unrecognized/blank role defaults to 'kitchen'
// (applied server-side too, so this is just for an accurate preview).
function parseStaffCsv(text) {
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
  let nameIdx = 0, phoneIdx = 1, emailIdx = 2, roleIdx = 3;
  const header = rows[0].map(h => h.toLowerCase());
  const hasHeader = header.some(h => ['name', 'phone', 'email', 'role'].includes(h));
  if (hasHeader) {
    const ni = header.indexOf('name'), pi = header.indexOf('phone');
    const ei = header.indexOf('email'), ri = header.indexOf('role');
    if (ni !== -1) nameIdx = ni;
    if (pi !== -1) phoneIdx = pi;
    if (ei !== -1) emailIdx = ei;
    if (ri !== -1) roleIdx = ri;
    rows = rows.slice(1);
  }

  return rows.map(cells => {
    const role = (cells[roleIdx] || '').toLowerCase().trim();
    return {
      name:  cells[nameIdx]  || '',
      phone: cells[phoneIdx] || '',
      email: cells[emailIdx] || '',
      role:  ROLES.includes(role) ? role : 'kitchen',
    };
  }).filter(r => r.name || r.phone);
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

export default function Staff() {
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null); // null | 'add' | {id,...}
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDelete]   = useState(null);
  const [pinTarget, setPinTarget]   = useState(null); // driver to reset PIN for
  const [newPin, setNewPin]         = useState('');
  const [pinSaving, setPinSaving]   = useState(false);

  // Bulk CSV import
  const [bulkModal, setBulkModal]         = useState(false);
  const [bulkRows, setBulkRows]           = useState([]);
  const [bulkFileName, setBulkFileName]   = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult]       = useState(null);
  const fileInputRef = useRef(null);

  // Bulk select / remove / activate-deactivate
  const [selected, setSelected]           = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getStaff();
      setStaff(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(BLANK); setModal('add'); };
  const openEdit = (s) => { setForm({ ...s, shift_start: s.shift_start || '', shift_end: s.shift_end || '' }); setModal(s); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal === 'add') {
        await adminAPI.createStaff(form);
      } else {
        await adminAPI.updateStaff(modal.id, form);
      }
      setModal(null);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await adminAPI.deleteStaff(deleteTarget.id);
      setDelete(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(newPin)) { alert('PIN must be exactly 4 digits.'); return; }
    setPinSaving(true);
    try {
      await adminAPI.resetDriverPin(pinTarget.id, newPin);
      setPinTarget(null);
      setNewPin('');
      alert(`PIN updated for ${pinTarget.name}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setPinSaving(false);
    }
  };

  const openBulk = () => {
    setBulkRows([]); setBulkFileName(''); setBulkResult(null);
    setBulkModal(true);
  };

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setBulkRows(parseStaffCsv(String(reader.result || '')));
    reader.readAsText(file);
  };

  const runBulkImport = async () => {
    const valid = bulkRows.filter(r => r.name.trim());
    if (valid.length === 0) return;
    setBulkImporting(true);
    try {
      const result = await adminAPI.bulkImportStaff(valid);
      setBulkResult(result);
      setBulkRows([]);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkImporting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (rows) => {
    setSelected(prev => {
      const allSelected = rows.every(r => prev.has(r.id));
      const next = new Set(prev);
      rows.forEach(r => allSelected ? next.delete(r.id) : next.add(r.id));
      return next;
    });
  };

  const runBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      await adminAPI.bulkDeleteStaff([...selected]);
      setSelected(new Set());
      setBulkDeleteConfirm(false);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const runBulkStatus = async (is_active) => {
    setBulkActionLoading(true);
    try {
      await adminAPI.bulkSetStaffStatus([...selected], is_active);
      setSelected(new Set());
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    );
  }, [staff, search]);

  const active  = filteredStaff.filter(s => s.is_active);
  const inactive = filteredStaff.filter(s => !s.is_active);

  const exportCSV = () => {
    const headers = ['Name', 'Role', 'Email', 'Phone', 'Shift Start', 'Shift End', 'Notes', 'Status'];
    const rows = filteredStaff.map(s => [
      s.name, s.role, s.email || '', s.phone || '',
      s.shift_start || '', s.shift_end || '', s.notes || '',
      s.is_active ? 'Active' : 'Inactive',
    ]);
    downloadCsv(`habibi-staff-${Date.now()}.csv`, headers, rows);
  };

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-sub">{staff.length} team members</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={openBulk}>
            <Upload size={15} /> Bulk Import
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Staff
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
        <input
          className="input"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
        <p className="staff-role-legend">
          Only <strong>Delivery</strong> staff have app login (driver PIN). Kitchen, Manager, Cashier, and Server are roster entries only — no login or admin access.
        </p>
      </div>

      {err && <p className="text-error" style={{marginBottom:'1rem'}}>{err}</p>}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card" style={{
          marginBottom: '1rem', padding: '0.75rem 1.25rem', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
          borderLeft: '3px solid var(--color-primary)',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selected.size} selected</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" disabled={bulkActionLoading} onClick={() => runBulkStatus(true)}>
              <UserCheck size={13} /> Activate
            </button>
            <button className="btn btn-secondary btn-sm" disabled={bulkActionLoading} onClick={() => runBulkStatus(false)}>
              <UserX size={13} /> Deactivate
            </button>
            <button className="btn btn-danger btn-sm" disabled={bulkActionLoading} onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 size={13} /> Remove
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="staff-stats">
            {ROLES.map(r => {
              const count = staff.filter(s => s.role === r && s.is_active).length;
              return (
                <div key={r} className="card staff-stat-card">
                  <p className="staff-stat-label">{r.charAt(0).toUpperCase() + r.slice(1)}</p>
                  <p className="staff-stat-num">{count}</p>
                </div>
              );
            })}
          </div>

          {/* Active staff */}
          <div className="card" style={{marginBottom:'1.5rem'}}>
            <div className="staff-section-hdr">
              <span>Active Staff ({active.length})</span>
            </div>
            {active.length === 0 ? (
              <div className="empty"><Users size={32} /><p>No active staff</p></div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{width: 32}}>
                        <input
                          type="checkbox"
                          checked={active.length > 0 && active.every(s => selected.has(s.id))}
                          onChange={() => toggleSelectAll(active)}
                        />
                      </th>
                      <th>Name</th><th>Role</th><th>Contact</th><th>Shift</th><th>Notes</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(s => (
                      <tr key={s.id}>
                        <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                        <td style={{fontWeight:600}}>{s.name}</td>
                        <td><span className={`badge ${ROLE_COLOR[s.role] || 'badge-muted'}`}>{s.role}</span></td>
                        <td>
                          <p>{s.email || '—'}</p>
                          <p className="text-muted" style={{fontSize:'0.72rem'}}>{s.phone || ''}</p>
                        </td>
                        <td>
                          {s.shift_start && s.shift_end
                            ? <span className="staff-shift"><Clock size={12} /> {s.shift_start} – {s.shift_end}</span>
                            : <span className="text-muted">—</span>
                          }
                        </td>
                        <td className="text-muted" style={{fontSize:'0.78rem',maxWidth:160}}>{s.notes || '—'}</td>
                        <td>
                          <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                            {s.role === 'delivery' && (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Reset driver PIN directly"
                                  onClick={() => { setPinTarget(s); setNewPin(''); }}
                                >
                                  <KeyRound size={12} /> Reset PIN
                                </button>
                                {s.phone && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    title="Send driver PIN setup link via SMS"
                                    onClick={async () => {
                                      try {
                                        await adminAPI.sendDriverSetupSms(s.id);
                                        alert(`Setup SMS sent to ${s.name}`);
                                      } catch (e) { alert(e.message); }
                                    }}
                                  >
                                    <Smartphone size={12} /> PIN SMS
                                  </button>
                                )}
                              </>
                            )}
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(s)} title="Edit"><Pencil size={13} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDelete(s)} title="Remove"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inactive staff */}
          {inactive.length > 0 && (
            <div className="card">
              <div className="staff-section-hdr text-muted">Inactive / Former Staff ({inactive.length})</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{width: 32}}>
                        <input
                          type="checkbox"
                          checked={inactive.length > 0 && inactive.every(s => selected.has(s.id))}
                          onChange={() => toggleSelectAll(inactive)}
                        />
                      </th>
                      <th>Name</th><th>Role</th><th>Contact</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactive.map(s => (
                      <tr key={s.id} style={{opacity:0.6}}>
                        <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                        <td>{s.name}</td>
                        <td><span className={`badge ${ROLE_COLOR[s.role] || 'badge-muted'}`}>{s.role}</span></td>
                        <td>{s.email || '—'}</td>
                        <td>
                          <div style={{display:'flex',gap:'0.4rem'}}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(s)}><Pencil size={13} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDelete(s)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">{modal === 'add' ? 'Add Staff Member' : 'Edit Staff Member'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="staff-form-grid">
                <div className="field">
                  <label>Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" />
                </div>
                <div className="field">
                  <label>Role</label>
                  <select className="input select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                  </select>
                  <p className="staff-role-hint">
                    {form.role === 'delivery'
                      ? 'Has PIN-based login to the driver app.'
                      : 'Roster only — this role has no app login or admin access.'}
                  </p>
                </div>
                <div className="field">
                  <label>Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="work@habibihe.com" />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+1 (718) 555-0000" />
                </div>
                <div className="field">
                  <label>Shift Start</label>
                  <input className="input" type="time" value={form.shift_start} onChange={e => setForm({...form, shift_start: e.target.value})} />
                </div>
                <div className="field">
                  <label>Shift End</label>
                  <input className="input" type="time" value={form.shift_end} onChange={e => setForm({...form, shift_end: e.target.value})} />
                </div>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea className="input textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any notes..." />
              </div>
              {modal !== 'add' && (
                <label className="staff-active-toggle">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
                  <span>Active</span>
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? <div className="spinner" /> : <><Check size={14}/> {modal === 'add' ? 'Add' : 'Save'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {pinTarget && (
        <div className="modal-overlay" onClick={() => setPinTarget(null)}>
          <div className="modal" style={{maxWidth:380}} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Reset PIN — {pinTarget.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setPinTarget(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>New 4-digit PIN</label>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="e.g. 5678"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.slice(0,4))}
                  onKeyDown={e => e.key === 'Enter' && savePin()}
                  autoFocus
                />
                <p style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'0.4rem'}}>
                  Driver will use this PIN to log in at habibihe.com/driver/login
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPinTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePin} disabled={pinSaving || newPin.length !== 4}>
                {pinSaving ? <div className="spinner"/> : <><Check size={14}/> Set PIN</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDelete(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Remove Staff Member</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDelete(null)}><X size={16} /></button>
            </div>
            <p style={{marginBottom:'1.5rem'}}>Remove <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={remove}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Remove {selected.size} Staff Member{selected.size !== 1 ? 's' : ''}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setBulkDeleteConfirm(false)}><X size={16} /></button>
            </div>
            <p style={{marginBottom:'1.5rem'}}>
              Remove {selected.size} selected staff member{selected.size !== 1 ? 's' : ''}? This cannot be undone.
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
              <h2 className="modal-title">Bulk Import Staff</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setBulkModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {bulkResult ? (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    ✓ {bulkResult.created_count} staff member{bulkResult.created_count !== 1 ? 's' : ''} added
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                    Any delivery role with a phone number was texted a PIN setup link automatically.
                  </p>
                  {bulkResult.skipped_count > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--color-danger, #e5484d)', marginBottom: '0.4rem' }}>
                        {bulkResult.skipped_count} skipped
                      </p>
                      <div className="table-wrap">
                        <table className="table">
                          <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Reason</th></tr></thead>
                          <tbody>
                            {bulkResult.skipped.map((s, i) => (
                              <tr key={i}>
                                <td>{s.name || '—'}</td>
                                <td>{s.phone || '—'}</td>
                                <td>{s.role || '—'}</td>
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
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                    Upload a CSV with <code>name</code>, <code>phone</code>, <code>email</code>, and <code>role</code> columns
                    (header row optional — role defaults to "kitchen" if missing or unrecognized). Rows with role
                    "delivery" and a phone are immediately texted a link to set their own PIN, same as adding one at a time.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={handleCsvFile}
                  />
                  <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet size={14} /> {bulkFileName || 'Choose CSV file…'}
                  </button>

                  {bulkRows.length > 0 && (
                    <div className="table-wrap" style={{ marginTop: '1rem', maxHeight: 260, overflowY: 'auto' }}>
                      <table className="table">
                        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Role</th></tr></thead>
                        <tbody>
                          {bulkRows.map((r, i) => (
                            <tr key={i} style={!r.name.trim() ? { opacity: 0.5 } : undefined}>
                              <td>{r.name || <em>missing name</em>}</td>
                              <td>{r.phone || '—'}</td>
                              <td>{r.email || '—'}</td>
                              <td><span className={`badge ${ROLE_COLOR[r.role] || 'badge-muted'}`}>{r.role}</span></td>
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
                  <button
                    className="btn btn-primary"
                    onClick={runBulkImport}
                    disabled={bulkImporting || bulkRows.filter(r => r.name.trim()).length === 0}
                  >
                    {bulkImporting
                      ? <div className="spinner" />
                      : <><Check size={14} /> Import {bulkRows.filter(r => r.name.trim()).length || ''} Staff</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
