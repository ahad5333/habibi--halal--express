import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useSettings } from '../context/SettingsContext';
import { useLegalDoc, RichText } from '../utils/legalText';
import './LegalPage.css';

// Content comes from the shared data/legalDocs.js via useLegalDoc -- see
// utils/legalText.jsx. "Feedback & Contact" used to be overridden here with a
// hardcoded sentence that dropped the contact details, because the shared copy
// hardcoded a static email/phone that could disagree with CPanel. That copy now
// fills {email}/{phone} from CPanel, so the override is gone: a hand-kept second
// version of legal text is the drift this refactor exists to prevent. The
// contact card below repeats the details, which is redundant but consistent.

const Accessibility = () => {
  const doc = useLegalDoc('accessibility');
  const sections = doc.sections;
  const settings = useSettings();
  return (
  <>
    <SEO
      title="Accessibility Statement — Habibi Halal Express"
      description="Habibi Halal Express is committed to digital accessibility for all users. Learn about our accessibility features and how to contact us for assistance."
    />

    {/* Hero */}
    <div className="legal-hero">
      <picture>
        <source srcSet="/images/titles/accessibility-title.webp" type="image/webp" />
        <img src="/images/titles/accessibility-title.jpg" alt="Accessibility Statement — Habibi Halal Express" className="legal-hero-img" />
      </picture>
    </div>
    <div className="legal-hero-sub">
      <p className="legal-subtitle">{doc.subtitle}</p>
    </div>

    <div className="legal-body">
      <div className="legal-container" style={{ padding: '3.5rem 1.5rem' }}>

        <p className="legal-intro"><RichText text={doc.intro} /></p>

        <div className="legal-sections">
          {sections.map(s => (
            <div key={s.title} className="legal-section">
              <div className="legal-section-hdr">
                <span className="legal-section-icon">{s.icon}</span>
                <h2 className="legal-section-title">{s.title}</h2>
              </div>
              <p className="legal-section-body" style={{ whiteSpace: 'pre-line' }}>{s.content}</p>
            </div>
          ))}
        </div>

        {/* Contact card */}
        <div style={{
          marginTop: '2rem',
          background: 'linear-gradient(135deg,#0a0a0a 0%,#0d1f0d 100%)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 14,
          padding: '2rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: '2.5rem', flexShrink: 0 }}>♿</div>
          <div>
            <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Accessibility Contact
            </p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <strong style={{ color: '#fff' }}>Habibi Halal Express, Inc.</strong><br />
              {settings.address_street}, {settings.address_city}, {settings.address_state} {settings.address_zip}<br />
              Email: <a href={`mailto:${settings.email_contact}`} style={{ color: '#E5B64E' }}>{settings.email_contact}</a><br />
              Phone: <a href={`tel:+1${settings.phone_main.replace(/\D/g,'')}`} style={{ color: '#E5B64E' }}>{settings.phone_main}</a>
            </p>
          </div>
        </div>

        <p className="legal-updated">
          Last updated: {doc.updated} &nbsp;·&nbsp;
          <Link to="/privacy-policy">Privacy Policy</Link> &nbsp;·&nbsp;
          <Link to="/terms">Terms of Service</Link> &nbsp;·&nbsp;
          <Link to="/sms-terms">SMS Terms</Link> &nbsp;·&nbsp;
          <Link to="/contact">Contact Us</Link>
        </p>
      </div>
    </div>
  </>
  );
};

export default Accessibility;
