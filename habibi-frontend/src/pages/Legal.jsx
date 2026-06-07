import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Shield, Clock, MapPin, Mail, Phone } from 'lucide-react';
import SEO from '../components/SEO';
import { DOC_LIST, DOCS } from '../data/legalDocs';
import './Legal.css';

function Section({ s }) {
  return (
    <div className="lh-section">
      <div className="lh-section-hdr">
        <span className="lh-section-icon">{s.icon}</span>
        <h2 className="lh-section-title">{s.title}</h2>
      </div>
      {s.content && (
        <p className="lh-section-body" style={{ whiteSpace: 'pre-line' }}>{s.content}</p>
      )}
      {s.list && (
        <ul className="lh-list">
          {s.list.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function Legal() {
  const [params, setParams] = useSearchParams();
  const activeId = DOC_LIST.some(d => d.id === params.get('doc')) ? params.get('doc') : 'terms';
  const doc = DOCS[activeId];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeId]);

  const switchDoc = (id) => setParams({ doc: id });

  return (
    <>
      <SEO
        title={`${doc.label} — Habibi Halal Express Legal Center`}
        description={doc.intro.substring(0, 155)}
      />

      <div className="legal-hub">

        {/* ── Left sidebar ── */}
        <aside className="lh-sidebar">
          <div className="lh-brand">
            <div className="lh-brand-icon"><Shield size={20} /></div>
            <div>
              <p className="lh-brand-name">Legal Center</p>
              <p className="lh-brand-sub">Habibi Halal Express</p>
            </div>
          </div>

          <nav className="lh-nav">
            {DOC_LIST.map(d => (
              <button
                key={d.id}
                className={`lh-nav-item ${d.id === activeId ? 'active' : ''}`}
                onClick={() => switchDoc(d.id)}
              >
                <span className="lh-nav-icon">{d.icon}</span>
                <div className="lh-nav-text">
                  <p className="lh-nav-label">{d.label}</p>
                  <p className="lh-nav-desc">{d.desc}</p>
                </div>
                {d.id === activeId && <span className="lh-nav-dot" />}
              </button>
            ))}
          </nav>

          <div className="lh-sidebar-footer">
            <p className="lh-footer-label">Questions?</p>
            <a href="mailto:habibi@habibihe.com" className="lh-footer-link">
              <Mail size={13} /> habibi@habibihe.com
            </a>
            <a href="mailto:admin@habibihe.com" className="lh-footer-link">
              <Mail size={13} /> admin@habibihe.com
            </a>
            <a href="tel:7184000443" className="lh-footer-link">
              <Phone size={13} /> (718) 400-0443
            </a>
            <a href="https://maps.google.com/?q=2974+Jerome+Ave+Bronx+NY" target="_blank" rel="noreferrer" className="lh-footer-link">
              <MapPin size={13} /> 2974 Jerome Ave, Bronx NY
            </a>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="lh-main">

          {/* Document header */}
          <div className="lh-doc-header">
            <div className="lh-doc-header-glow" />
            <div className="lh-doc-header-inner">
              <span className="lh-doc-big-icon">{doc.icon}</span>
              <div>
                <p className="lh-doc-eyebrow">Habibi Halal Express, Inc.</p>
                <h1 className="lh-doc-title">{doc.label}</h1>
                <p className="lh-doc-subtitle">{doc.subtitle}</p>
                <div className="lh-doc-meta">
                  <span><Clock size={13} /> Last updated: {doc.updated}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Document body */}
          <div className="lh-body">

            <p className="lh-intro">{doc.intro}</p>

            {activeId === 'sms' && (
              <div className="lh-sms-banner">
                <p className="lh-sms-banner-label">Quick Reference</p>
                <div className="lh-sms-cmds">
                  {[
                    { cmd: 'STOP', desc: 'Opt out of all messages' },
                    { cmd: 'HELP', desc: 'Get support information' },
                    { cmd: 'START', desc: 'Re-enroll in messages' },
                  ].map(r => (
                    <div key={r.cmd} className="lh-sms-cmd">
                      <p className="lh-sms-cmd-word">{r.cmd}</p>
                      <p className="lh-sms-cmd-desc">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="lh-sections">
              {doc.sections.map((s, i) => <Section key={i} s={s} />)}
            </div>

            <div className="lh-contact-card">
              <p className="lh-contact-label">Contact Information</p>
              <p className="lh-contact-body">
                <strong>Habibi Halal Express, Inc.</strong><br />
                2974 Jerome Ave, Bronx, NY 10468<br /><br />
                Customer Service: <a href="mailto:habibi@habibihe.com">habibi@habibihe.com</a><br />
                Urgent Matters: <a href="mailto:urgent@habibihe.com">urgent@habibihe.com</a><br />
                Legal &amp; Compliance: <a href="mailto:admin@habibihe.com">admin@habibihe.com</a><br />
                Wholesale Accounts: <a href="mailto:merchant@habibihe.com">merchant@habibihe.com</a><br />
                Media Inquiries: <a href="mailto:media@habibihe.com">media@habibihe.com</a><br /><br />
                Phone: <a href="tel:7184000443">(718) 400-0443</a><br />
                Fax: (718) 400-0442
              </p>
            </div>

            <div className="lh-doc-footer">
              <span>Last updated: {doc.updated}</span>
              <div className="lh-doc-footer-links">
                {DOC_LIST.filter(d => d.id !== activeId).map(d => (
                  <button key={d.id} className="lh-footer-doc-link" onClick={() => switchDoc(d.id)}>
                    {d.icon} {d.label}
                  </button>
                ))}
                <Link to="/contact" className="lh-footer-doc-link">Contact Us</Link>
              </div>
            </div>

          </div>
        </main>

      </div>
    </>
  );
}
