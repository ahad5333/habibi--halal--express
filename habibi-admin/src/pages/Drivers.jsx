import React, { useState, useEffect, useRef } from 'react';
import { Truck, Plus, Pencil, Trash2, X, Check, KeyRound, Smartphone, Wifi, WifiOff, Upload, FileSpreadsheet } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Staff.css';

const BLANK = { name: '', email: '', phone: '', shift_start: '', shift_end: '', notes: '', is_active: true, vehicle_type: '', vehicle_plate: '', insurance_expiry: '' };

// Days until an insurance_expiry date; negative means already expired.
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diffMs / 86400000);
}

// Minimal CSV parser — handles quoted fields (so a name with a comma in it
// doesn't break column alignment). Matches "name"/"phone" headers case-
// insensitively; falls back to column order (name, phone) if there's no
// recognizable header row at all.
function parseDriverCsv(text) {
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
  let nameIdx = 0, phoneIdx = 1;
  const header = rows[0].map(h => h.toLowerCase());
  const hasHeader = header.some(h => h === 'name' || h === 'phone');
  if (hasHeader) {
    const ni = header.indexOf('name');
    const pi = header.indexOf('phone');
    if (ni !== -1) nameIdx = ni;
    if (pi !== -1) phoneIdx = pi;
    rows = rows.slice(1);
  }

  return rows.map(cells => ({
    name:  cells[nameIdx]  || '',
    phone: cells[phoneIdx] || '',
  })).filter(r => r.name || r.phone);
}

export default function Drivers() {
  const [drivers, setDrivers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDelete] = useState(null);
  const [pinTarget, setPinTarget] = useState(null);
  const [newPin, setNewPin]       = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [smsPrompt, setSmsPrompt] = useState(null); // {id, name, phone} shown after create

  // Bulk CSV import
  const [bulkModal, setBulkModal]     = useState(false);
  const [bulkRows, setBulkRows]       = useState([]);   // parsed preview rows
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult]   = useState(null); // { created_count, skipped_count, skipped }
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      setLoading(true);
      const [staffList, dispatchList] = await Promise.all([
        adminAPI.getStaff(),
        adminAPI.getDeliveryDrivers().catch(() => []),
      ]);
      const dutyMap = {};
      (dispatchList || []).forEach(d => {
        dutyMap[d.id] = { is_on_duty: d.is_on_duty, active_assignments: parseInt(d.active_assignments) || 0 };
      });
      setDrivers(
        staffList
          .filter(s => s.role === 'delivery')
          .map(s => ({ ...s, ...(dutyMap[s.id] || { is_on_duty: false, active_assignments: 0 }) }))
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(BLANK); setModal('add'); };
  const openEdit = (d) => {
    setForm({
      ...d,
      shift_start: d.shift_start || '',
      shift_end: d.shift_end || '',
      vehicle_type: d.vehicle_type || '',
      vehicle_plate: d.vehicle_plate || '',
      // Postgres DATE columns come back as full ISO timestamps via the pg
      // driver's JSON serialization -- <input type="date"> needs YYYY-MM-DD only.
      insurance_expiry: d.insurance_expiry ? String(d.insurance_expiry).slice(0, 10) : '',
    });
    setModal(d);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal === 'add') {
        const created = await adminAPI.createStaff({ ...form, role: 'delivery' });
        setModal(null);
        load();
        if (form.phone && created?.id) setSmsPrompt({ id: created.id, name: form.name.trim(), phone: form.phone });
      } else {
        await adminAPI.updateStaff(modal.id, form);
        setModal(null);
        load();
      }
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
    reader.onload = () => setBulkRows(parseDriverCsv(String(reader.result || '')));
    reader.readAsText(file);
  };

  const runBulkImport = async () => {
    const valid = bulkRows.filter(r => r.name.trim());
    if (valid.length === 0) return;
    setBulkImporting(true);
    try {
      const result = await adminAPI.bulkImportDrivers(valid);
      setBulkResult(result);
      setBulkRows([]);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkImporting(false);
    }
  };

  const sendSms = async (id) => {
    try {
      await adminAPI.sendDriverSetupSms(id);
      alert('Setup SMS sent!');
    } catch (e) {
      alert(e.message);
    }
  };

  const active   = drivers.filter(d => d.is_active);
  const inactive = drivers.filter(d => !d.is_active);
  const onDuty   = active.filter(d => d.is_on_duty).length;

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Drivers</h1>
          <p className="page-sub">{active.length} active · {onDuty} on duty</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={openBulk}>
            <Upload size={15} /> Bulk Import
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Driver
          </button>
        </div>
      </div>

      {err && <p className="text-error" style={{ marginBottom: '1rem' }}>{err}</p>}

      {/* Post-create SMS prompt */}
      {smsPrompt && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-primary)' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Driver added!</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Send {smsPrompt.name} a PIN setup link via SMS to {smsPrompt.phone}?
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => { await sendSms(smsPrompt.id); setSmsPrompt(null); }}
            >
              <Smartphone size={13} /> Send Setup SMS
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSmsPrompt(null)}>Skip</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="staff-section-hdr">
              <span>Active Drivers ({active.length})</span>
            </div>
            {active.length === 0 ? (
              <div className="empty"><Truck size={32} /><p>No active drivers — add one above</p></div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Phone</th><th>Status</th><th>Active Runs</th><th>Shift</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(d => {
                      const expDays = daysUntil(d.insurance_expiry);
                      return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>
                          {d.name}
                          {expDays !== null && expDays < 0 && (
                            <div className="badge badge-error" style={{ marginTop: 4, fontSize: '0.68rem' }}>⚠ Insurance EXPIRED</div>
                          )}
                          {expDays !== null && expDays >= 0 && expDays <= 14 && (
                            <div className="badge badge-warning" style={{ marginTop: 4, fontSize: '0.68rem' }}>⚠ Insurance expires in {expDays}d</div>
                          )}
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.85rem' }}>{d.phone || '—'}</td>
                        <td>
                          {d.is_on_duty
                            ? <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Wifi size={11} /> On Duty</span>
                            : <span className="badge badge-muted"   style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><WifiOff size={11} /> Off Duty</span>
                          }
                        </td>
                        <td>
                          {d.active_assignments > 0
                            ? <span className="badge badge-warning">{d.active_assignments} active</span>
                            : <span className="text-muted">—</span>
                          }
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {d.shift_start && d.shift_end ? `${d.shift_start} – ${d.shift_end}` : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setPinTarget(d); setNewPin(''); }}>
                              <KeyRound size={12} /> Reset PIN
                            </button>
                            {d.phone && (
                              <button className="btn btn-secondary btn-sm" onClick={() => sendSms(d.id)}>
                                <Smartphone size={12} /> Setup SMS
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(d)} title="Edit"><Pencil size={13} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDelete(d)} title="Remove"><Trash2 size={13} /></button>
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

          {inactive.length > 0 && (
            <div className="card">
              <div className="staff-section-hdr text-muted">Inactive Drivers ({inactive.length})</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Name</th><th>Phone</th><th>Actions</th></tr></thead>
                  <tbody>
                    {inactive.map(d => (
                      <tr key={d.id} style={{ opacity: 0.6 }}>
                        <td>{d.name}</td>
                        <td>{d.phone || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(d)}><Pencil size={13} /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDelete(d)}><Trash2 size={13} /></button>
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
              <h2 className="modal-title">{modal === 'add' ? 'Add Driver' : 'Edit Driver'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="staff-form-grid">
                <div className="field">
                  <label>Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (718) 555-0000" />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="driver@habibihe.com" />
                </div>
                <div className="field" />
                <div className="field">
                  <label>Shift Start</label>
                  <input className="input" type="time" value={form.shift_start} onChange={e => setForm({ ...form, shift_start: e.target.value })} />
                </div>
                <div className="field">
                  <label>Shift End</label>
                  <input className="input" type="time" value={form.shift_end} onChange={e => setForm({ ...form, shift_end: e.target.value })} />
                </div>
                <div className="field">
                  <label>Vehicle Type</label>
                  <input className="input" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} placeholder="e.g. Sedan, Scooter" />
                </div>
                <div className="field">
                  <label>License Plate</label>
                  <input className="input" value={form.vehicle_plate} onChange={e => setForm({ ...form, vehicle_plate: e.target.value })} placeholder="e.g. ABC1234" />
                </div>
                <div className="field">
                  <label>Insurance Expiry</label>
                  <input className="input" type="date" value={form.insurance_expiry} onChange={e => setForm({ ...form, insurance_expiry: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea className="input textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything else worth knowing about this driver" />
              </div>
              {modal !== 'add' && (
                <label className="staff-active-toggle">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  <span>Active</span>
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? <div className="spinner" /> : <><Check size={14} /> {modal === 'add' ? 'Add Driver' : 'Save'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {pinTarget && (
        <div className="modal-overlay" onClick={() => setPinTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Reset PIN — {pinTarget.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setPinTarget(null)}><X size={16} /></button>
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
                  onChange={e => setNewPin(e.target.value.slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && savePin()}
                  autoFocus
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                  Driver logs in at habibihe.com/driver/login
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPinTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePin} disabled={pinSaving || newPin.length !== 4}>
                {pinSaving ? <div className="spinner" /> : <><Check size={14} /> Set PIN</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDelete(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Remove Driver</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDelete(null)}><X size={16} /></button>
            </div>
            <p style={{ marginBottom: '1.5rem' }}>Remove <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={remove}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkModal && (
        <div className="modal-overlay" onClick={() => setBulkModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h2 className="modal-title">Bulk Import Drivers</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setBulkModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {bulkResult ? (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    ✓ {bulkResult.created_count} driver{bulkResult.created_count !== 1 ? 's' : ''} added
                    {bulkResult.created_count > 0 && ' — setup SMS sent to each'}
                  </p>
                  {bulkResult.skipped_count > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--color-danger, #e5484d)', marginBottom: '0.4rem' }}>
                        {bulkResult.skipped_count} skipped
                      </p>
                      <div className="table-wrap">
                        <table className="table">
                          <thead><tr><th>Name</th><th>Phone</th><th>Reason</th></tr></thead>
                          <tbody>
                            {bulkResult.skipped.map((s, i) => (
                              <tr key={i}>
                                <td>{s.name || '—'}</td>
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
                    Upload a CSV with <code>name</code> and <code>phone</code> columns (header row optional —
                    without one, the first column is treated as name, the second as phone). Each driver is
                    added without a PIN and immediately sent a text to set their own.
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
                        <thead><tr><th>Name</th><th>Phone</th></tr></thead>
                        <tbody>
                          {bulkRows.map((r, i) => (
                            <tr key={i} style={!r.name.trim() ? { opacity: 0.5 } : undefined}>
                              <td>{r.name || <em>missing name</em>}</td>
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
                  <button
                    className="btn btn-primary"
                    onClick={runBulkImport}
                    disabled={bulkImporting || bulkRows.filter(r => r.name.trim()).length === 0}
                  >
                    {bulkImporting
                      ? <div className="spinner" />
                      : <><Check size={14} /> Import {bulkRows.filter(r => r.name.trim()).length || ''} Drivers</>}
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
