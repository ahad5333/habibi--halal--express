import React, { useState, useEffect, useRef } from 'react';
import './Careers.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const departments = [
  {
    id: 'management',
    label: 'The Visionaries',
    title: 'Management',
    description: 'Our leadership orchestrates the symphony of service with precision and cultural integrity.',
    img: '/images/staff/management.png',
    size: 'large',
  },
  {
    id: 'kitchen',
    label: 'The Artists',
    title: 'Kitchen',
    description: 'Masters of Halal gastronomy and flavor architecture.',
    img: '/images/staff/kitchen.png',
    size: 'large',
  },
  {
    id: 'serving',
    label: 'The Ambassadors',
    title: 'Serving',
    description: 'Guiding our guests through an immersive culinary journey.',
    img: '/images/staff/serving.png',
    size: 'small',
  },
  {
    id: 'delivery',
    label: 'The Logistics',
    title: 'Delivery',
    description: 'Precision on every route, freshness at every door.',
    img: '/images/staff/delivery.png',
    size: 'small',
  },
  {
    id: 'stock',
    label: 'The Foundation',
    title: 'Stock Staff',
    description: 'The backbone of our artisanal supply chain.',
    img: '/images/staff/stock.png',
    size: 'small',
  },
];

const EMPTY_FORM = {
  name: '', email: '', phone: '', role_applied: '', cover_message: '', vacancy_id: '',
};

const Careers = () => {
  const [vacancies, setVacancies] = useState([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null); // { success, message }
  const openRolesRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/careers/vacancies`)
      .then(r => r.json())
      .then(data => { setVacancies(Array.isArray(data) ? data : []); })
      .catch(() => setVacancies([]))
      .finally(() => setVacanciesLoading(false));
  }, []);

  const scrollToRoles = () => {
    openRolesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openModal = (vacancyId = '') => {
    setForm({ ...EMPTY_FORM, vacancy_id: vacancyId });
    setResumeFile(null);
    setSubmitResult(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (resumeFile) fd.append('resume', resumeFile);

      const res = await fetch(`${API_BASE}/api/careers/apply`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitResult({ success: true, message: 'Application submitted! We\'ll be in touch soon.' });
        setForm(EMPTY_FORM);
        setResumeFile(null);
      } else {
        setSubmitResult({ success: false, message: data.error || 'Submission failed. Please try again.' });
      }
    } catch {
      setSubmitResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="careers-page">

      {/* Hero */}
      <section className="careers-hero">
        <div className="container">
          <div className="careers-hero-content">
            <h1 className="careers-hero-title">The Artisans <em>Behind</em> the Art.</h1>
            <p className="careers-hero-sub">
              Join a collective of culinary masters and service professionals dedicated to the quiet luxury of artisanal Halal dining.
            </p>
          </div>
        </div>
      </section>

      {/* Department Grid */}
      <section className="section departments-section">
        <div className="container">
          <div className="dept-grid">
            <div className="dept-row row-two">
              {departments.slice(0, 2).map(dept => (
                <div key={dept.id} className="dept-card dept-card-large">
                  <img src={dept.img} alt={dept.title} className="dept-img" />
                  <div className="dept-overlay">
                    <span className="dept-label">{dept.label}</span>
                    <h3 className="dept-title">{dept.title}</h3>
                    <p className="dept-desc">{dept.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="dept-row row-three">
              {departments.slice(2).map(dept => (
                <div key={dept.id} className="dept-card dept-card-small">
                  <img src={dept.img} alt={dept.title} className="dept-img" />
                  <div className="dept-overlay">
                    <span className="dept-label">{dept.label}</span>
                    <h3 className="dept-title">{dept.title}</h3>
                    <p className="dept-desc">{dept.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hiring Section */}
      <section className="section hiring-section">
        <div className="container hiring-layout">
          <div className="hiring-content">
            <h2 className="hiring-title text-primary">We Are Hiring.</h2>
            <p className="text-muted mb-8">
              We are seeking dedicated professionals to expand our artisanal family. We prioritize candidates with specialized certifications who share our commitment to excellence.
            </p>

            <div className="requirements-list">
              <div className="requirement-item">
                <div className="req-icon">🪪</div>
                <div>
                  <h4 className="req-title">Mobile Food Vendor Licenses</h4>
                  <p className="text-muted text-sm">Required for our signature express fleet operations.</p>
                </div>
              </div>
              <div className="requirement-item">
                <div className="req-icon">🚗</div>
                <div>
                  <h4 className="req-title">Valid Driving Licenses</h4>
                  <p className="text-muted text-sm">For our logistics and premium home-delivery service.</p>
                </div>
              </div>
            </div>

            <div className="hiring-actions flex gap-4 mt-10">
              <button className="btn btn-primary" onClick={() => openModal()}>Submit Resume</button>
              <button className="btn btn-outline" onClick={scrollToRoles}>View Open Roles</button>
            </div>
          </div>

          <div className="hiring-image-col">
            <div className="hiring-image">
              <div className="positions-badge">
                <span className="positions-num text-primary">{vacanciesLoading ? '—' : `${vacancies.length}+`}</span>
                <span className="text-xs text-muted uppercase tracking-wider">Active Positions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Roles */}
      <section className="section open-roles-section" ref={openRolesRef}>
        <div className="container">
          <h2 className="section-title">Open <em>Roles</em></h2>
          <p className="section-subtitle text-muted">Explore current opportunities across all departments.</p>

          {vacanciesLoading ? (
            <div className="roles-loading">
              {[1,2,3].map(i => <div key={i} className="role-skeleton" />)}
            </div>
          ) : vacancies.length === 0 ? (
            <div className="roles-empty">
              <p>No open positions right now. Check back soon or submit your resume — we keep strong candidates on file.</p>
              <button className="btn btn-primary" onClick={() => openModal()}>Submit Resume Anyway</button>
            </div>
          ) : (
            <div className="roles-list">
              {vacancies.map(v => (
                <div key={v.id} className="role-card">
                  <div className="role-card-left">
                    <div className="role-meta">
                      {v.department && <span className="role-dept">{v.department}</span>}
                      <span className="role-type">{v.type || 'Full-time'}</span>
                    </div>
                    <h3 className="role-title">{v.title}</h3>
                    <p className="role-location">📍 {v.location || 'Bronx, NY'}</p>
                    {v.description && <p className="role-desc">{v.description}</p>}
                    {v.salary_range && <p className="role-salary">💰 {v.salary_range}</p>}
                  </div>
                  <div className="role-card-right">
                    <button className="btn btn-primary btn-sm" onClick={() => openModal(String(v.id))}>
                      Apply Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Submit Resume Modal */}
      {modalOpen && (
        <div className="careers-modal-overlay" onClick={closeModal}>
          <div className="careers-modal" onClick={e => e.stopPropagation()}>
            <button className="careers-modal-close" onClick={closeModal}>✕</button>
            <h2 className="careers-modal-title">Submit Your Resume</h2>
            <p className="careers-modal-sub text-muted">We'll review your application and reach out if there's a fit.</p>

            {submitResult?.success ? (
              <div className="careers-success">
                <div className="careers-success-icon">✓</div>
                <p>{submitResult.message}</p>
                <button className="btn btn-outline" onClick={closeModal}>Close</button>
              </div>
            ) : (
              <form className="careers-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+1 (000) 000-0000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role Applying For</label>
                    {vacancies.length > 0 ? (
                      <select
                        value={form.vacancy_id}
                        onChange={e => {
                          const v = vacancies.find(x => String(x.id) === e.target.value);
                          setForm(f => ({ ...f, vacancy_id: e.target.value, role_applied: v?.title || '' }));
                        }}
                      >
                        <option value="">Select a position…</option>
                        {vacancies.map(v => (
                          <option key={v.id} value={String(v.id)}>{v.title}</option>
                        ))}
                        <option value="">General Application</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.role_applied}
                        onChange={e => setForm(f => ({ ...f, role_applied: e.target.value }))}
                        placeholder="e.g. Kitchen Staff, Driver…"
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Cover Message</label>
                  <textarea
                    rows={4}
                    value={form.cover_message}
                    onChange={e => setForm(f => ({ ...f, cover_message: e.target.value }))}
                    placeholder="Tell us a bit about yourself and why you'd like to join Habibi…"
                  />
                </div>

                <div className="form-group">
                  <label>Resume / CV <span className="text-muted">(PDF, DOC, DOCX — max 8MB)</span></label>
                  <div className="file-upload-wrap">
                    <input
                      type="file"
                      id="resume-file"
                      accept=".pdf,.doc,.docx"
                      onChange={e => setResumeFile(e.target.files[0] || null)}
                      className="file-input-hidden"
                    />
                    <label htmlFor="resume-file" className="file-upload-btn">
                      {resumeFile ? resumeFile.name : 'Choose file…'}
                    </label>
                    {resumeFile && (
                      <button type="button" className="file-remove-btn" onClick={() => setResumeFile(null)}>✕</button>
                    )}
                  </div>
                </div>

                {submitResult?.success === false && (
                  <p className="careers-form-error">{submitResult.message}</p>
                )}

                <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Careers;
