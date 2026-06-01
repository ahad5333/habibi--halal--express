import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Eye, ChevronDown } from 'lucide-react';
import { adminAPI } from '../services/api';
import './Careers.css';

const VACANCY_BLANK = {
  title: '', department: '', location: 'Bronx, NY', type: 'full-time',
  description: '', requirements: '', salary_range: '', is_active: true,
};

const STATUS_COLORS = {
  pending:     'badge-warning',
  reviewed:    'badge-info',
  shortlisted: 'badge-success',
  rejected:    'badge-muted',
};

const STATUS_OPTIONS = ['pending', 'reviewed', 'shortlisted', 'rejected'];

export default function Careers() {
  const [tab, setTab] = useState('vacancies');

  // Vacancies state
  const [vacancies, setVacancies]     = useState([]);
  const [vLoading, setVLoading]       = useState(true);
  const [vModal, setVModal]           = useState(null); // null | 'add' | vacancy object
  const [vForm, setVForm]             = useState(VACANCY_BLANK);
  const [vSaving, setVSaving]         = useState(false);
  const [vDeleteId, setVDeleteId]     = useState(null);
  const [vError, setVError]           = useState('');

  // Applications state
  const [applications, setApplications] = useState([]);
  const [aLoading, setALoading]         = useState(true);
  const [aFilter, setAFilter]           = useState('');
  const [aModal, setAModal]             = useState(null); // application object
  const [aStatusEdit, setAStatusEdit]   = useState('');
  const [aNotes, setANotes]             = useState('');
  const [aSaving, setASaving]           = useState(false);

  const loadVacancies = async () => {
    setVLoading(true);
    try { setVacancies(await adminAPI.getCareersVacancies()); }
    catch (e) { setVError(e.message); }
    finally { setVLoading(false); }
  };

  const loadApplications = async () => {
    setALoading(true);
    try { setApplications(await adminAPI.getCareersApplications(aFilter)); }
    catch { setApplications([]); }
    finally { setALoading(false); }
  };

  useEffect(() => { loadVacancies(); }, []);
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab, aFilter]);

  // ── Vacancy CRUD ──────────────────────────────────────────────────────────
  const openAdd = () => { setVForm(VACANCY_BLANK); setVModal('add'); };
  const openEdit = (v) => { setVForm({ ...v }); setVModal(v); };
  const closeVModal = () => { setVModal(null); setVError(''); };

  const saveVacancy = async () => {
    if (!vForm.title.trim()) { setVError('Title is required'); return; }
    setVSaving(true);
    setVError('');
    try {
      if (vModal === 'add') {
        await adminAPI.createVacancy(vForm);
      } else {
        await adminAPI.updateVacancy(vModal.id, vForm);
      }
      closeVModal();
      loadVacancies();
    } catch (e) {
      setVError(e.message);
    } finally {
      setVSaving(false);
    }
  };

  const confirmDelete = async (id) => {
    try {
      await adminAPI.deleteVacancy(id);
      setVDeleteId(null);
      loadVacancies();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleActive = async (v) => {
    try {
      await adminAPI.updateVacancy(v.id, { ...v, is_active: !v.is_active });
      loadVacancies();
    } catch (e) {
      alert(e.message);
    }
  };

  // ── Application actions ───────────────────────────────────────────────────
  const openApp = (app) => {
    setAModal(app);
    setAStatusEdit(app.status);
    setANotes(app.notes || '');
  };

  const saveAppStatus = async () => {
    if (!aModal) return;
    setASaving(true);
    try {
      const updated = await adminAPI.updateApplicationStatus(aModal.id, aStatusEdit, aNotes);
      setApplications(prev => prev.map(a => a.id === updated.id ? updated : a));
      setAModal(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setASaving(false);
    }
  };

  return (
    <div className="careers-admin">
      <div className="page-header">
        <div>
          <h1 className="page-title">Careers</h1>
          <p className="page-sub">Manage job postings and review applications.</p>
        </div>
        {tab === 'vacancies' && (
          <button className="btn-admin btn-admin-primary" onClick={openAdd}>
            <Plus size={15} /> Add Position
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="careers-tabs">
        <button
          className={`careers-tab ${tab === 'vacancies' ? 'active' : ''}`}
          onClick={() => setTab('vacancies')}
        >
          Open Positions ({vacancies.length})
        </button>
        <button
          className={`careers-tab ${tab === 'applications' ? 'active' : ''}`}
          onClick={() => setTab('applications')}
        >
          Applications {applications.length > 0 ? `(${applications.length})` : ''}
        </button>
      </div>

      {/* ── Vacancies Tab ── */}
      {tab === 'vacancies' && (
        <div className="careers-panel">
          {vLoading ? (
            <div className="admin-loading-rows">
              {[1,2,3].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          ) : vacancies.length === 0 ? (
            <div className="empty-state">
              <p>No positions yet. Click "Add Position" to create your first job posting.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map(v => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.title}</td>
                    <td>{v.department || '—'}</td>
                    <td><span className="badge badge-info">{v.type || 'full-time'}</span></td>
                    <td>{v.location}</td>
                    <td>{v.salary_range || '—'}</td>
                    <td>
                      <button
                        className={`toggle-btn ${v.is_active ? 'toggle-on' : 'toggle-off'}`}
                        onClick={() => toggleActive(v)}
                      >
                        {v.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => openEdit(v)} title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn icon-btn-danger" onClick={() => setVDeleteId(v.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Applications Tab ── */}
      {tab === 'applications' && (
        <div className="careers-panel">
          <div className="app-filter-bar">
            <label>Filter by status:</label>
            <select value={aFilter} onChange={e => setAFilter(e.target.value)}>
              <option value="">All</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {aLoading ? (
            <div className="admin-loading-rows">
              {[1,2,3].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          ) : applications.length === 0 ? (
            <div className="empty-state">
              <p>No applications {aFilter ? `with status "${aFilter}"` : ''} yet.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Role</th>
                  <th>Position</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Resume</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {applications.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div className="applicant-name">{a.name}</div>
                      <div className="applicant-email">{a.email}</div>
                    </td>
                    <td>{a.role_applied || '—'}</td>
                    <td>{a.vacancy_title || 'General'}</td>
                    <td>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[a.status] || 'badge-muted'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      {a.resume_url ? (
                        <a
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${a.resume_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="resume-link"
                        >
                          View
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => openApp(a)} title="Review">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Vacancy Add/Edit Modal ── */}
      {vModal && (
        <div className="modal-overlay" onClick={closeVModal}>
          <div className="modal-box modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{vModal === 'add' ? 'Add Position' : 'Edit Position'}</h2>
              <button className="modal-close" onClick={closeVModal}><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Job Title *</label>
                  <input
                    value={vForm.title}
                    onChange={e => setVForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Kitchen Staff"
                  />
                </div>
                <div className="form-field">
                  <label>Department</label>
                  <input
                    value={vForm.department}
                    onChange={e => setVForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Kitchen, Delivery"
                  />
                </div>
                <div className="form-field">
                  <label>Type</label>
                  <select value={vForm.type} onChange={e => setVForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Location</label>
                  <input
                    value={vForm.location}
                    onChange={e => setVForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Bronx, NY"
                  />
                </div>
                <div className="form-field">
                  <label>Salary Range</label>
                  <input
                    value={vForm.salary_range}
                    onChange={e => setVForm(f => ({ ...f, salary_range: e.target.value }))}
                    placeholder="e.g. $18–$22/hr"
                  />
                </div>
                <div className="form-field form-field-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={vForm.is_active}
                      onChange={e => setVForm(f => ({ ...f, is_active: e.target.checked }))}
                    />
                    Active (visible on website)
                  </label>
                </div>
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={vForm.description}
                  onChange={e => setVForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Role overview…"
                />
              </div>
              <div className="form-field">
                <label>Requirements</label>
                <textarea
                  rows={3}
                  value={vForm.requirements}
                  onChange={e => setVForm(f => ({ ...f, requirements: e.target.value }))}
                  placeholder="What are the key requirements for this role?"
                />
              </div>

              {vError && <p className="form-error">{vError}</p>}
            </div>

            <div className="modal-footer">
              <button className="btn-admin btn-admin-ghost" onClick={closeVModal}>Cancel</button>
              <button className="btn-admin btn-admin-primary" onClick={saveVacancy} disabled={vSaving}>
                {vSaving ? 'Saving…' : vModal === 'add' ? 'Create Position' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {vDeleteId && (
        <div className="modal-overlay" onClick={() => setVDeleteId(null)}>
          <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Position</h2>
              <button className="modal-close" onClick={() => setVDeleteId(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure? This will permanently delete this job posting. Applications will remain in the database.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-admin btn-admin-ghost" onClick={() => setVDeleteId(null)}>Cancel</button>
              <button className="btn-admin btn-admin-danger" onClick={() => confirmDelete(vDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Application Review Modal ── */}
      {aModal && (
        <div className="modal-overlay" onClick={() => setAModal(null)}>
          <div className="modal-box modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Application — {aModal.name}</h2>
              <button className="modal-close" onClick={() => setAModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="app-detail-grid">
                <div className="app-detail-row"><span>Email</span><span>{aModal.email}</span></div>
                <div className="app-detail-row"><span>Phone</span><span>{aModal.phone || '—'}</span></div>
                <div className="app-detail-row"><span>Role Applied</span><span>{aModal.role_applied || '—'}</span></div>
                <div className="app-detail-row"><span>Position</span><span>{aModal.vacancy_title || 'General'}</span></div>
                <div className="app-detail-row"><span>Submitted</span><span>{new Date(aModal.created_at).toLocaleString()}</span></div>
                {aModal.resume_url && (
                  <div className="app-detail-row">
                    <span>Resume</span>
                    <a
                      href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${aModal.resume_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="resume-link"
                    >
                      Download Resume
                    </a>
                  </div>
                )}
              </div>

              {aModal.cover_message && (
                <div className="app-cover">
                  <label>Cover Message</label>
                  <p>{aModal.cover_message}</p>
                </div>
              )}

              <div className="form-grid-2" style={{ marginTop: '1.5rem' }}>
                <div className="form-field">
                  <label>Update Status</label>
                  <select value={aStatusEdit} onChange={e => setAStatusEdit(e.target.value)}>
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Internal Notes</label>
                <textarea
                  rows={3}
                  value={aNotes}
                  onChange={e => setANotes(e.target.value)}
                  placeholder="Private notes about this candidate…"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-admin btn-admin-ghost" onClick={() => setAModal(null)}>Close</button>
              <button className="btn-admin btn-admin-primary" onClick={saveAppStatus} disabled={aSaving}>
                {aSaving ? 'Saving…' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
