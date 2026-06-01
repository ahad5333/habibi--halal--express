import React, { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, X, Check, Clock } from 'lucide-react';
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

export default function Staff() {
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [modal, setModal]         = useState(null); // null | 'add' | {id,...}
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDelete] = useState(null);

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

  const active  = staff.filter(s => s.is_active);
  const inactive = staff.filter(s => !s.is_active);

  return (
    <div>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-sub">{staff.length} team members</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Add Staff
        </button>
      </div>

      {err && <p className="text-error" style={{marginBottom:'1rem'}}>{err}</p>}

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
                      <th>Name</th><th>Role</th><th>Contact</th><th>Shift</th><th>Notes</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(s => (
                      <tr key={s.id}>
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
                          <div style={{display:'flex',gap:'0.4rem'}}>
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
                  <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Actions</th></tr></thead>
                  <tbody>
                    {inactive.map(s => (
                      <tr key={s.id} style={{opacity:0.6}}>
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
    </div>
  );
}
