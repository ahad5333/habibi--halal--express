import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useSettings } from '../context/SettingsContext';
import { DOCS } from '../data/legalDocs';
import './LegalPage.css';

// See TermsOfService.jsx's comment -- section content now sources from the
// shared data/legalDocs.js instead of a page-local hardcoded copy.
const sections = DOCS.privacy.sections;

export default function PrivacyPolicy() {
  const settings = useSettings();
  return (
    <>
      <SEO
        title="Privacy Policy — Habibi Halal Express"
        description="Privacy Policy for Habibi Halal Express. Learn how we collect, use, and protect your personal information across our website, app, and ordering services."
      />

      <div className="legal-hero">
        <picture>
          <source srcSet="/images/titles/privacy-title.webp" type="image/webp" />
          <img src="/images/titles/privacy-title.jpg" alt="Privacy Policy — Habibi Halal Express" className="legal-hero-img" />
        </picture>
      </div>
      <div className="legal-hero-sub">
        <p className="legal-subtitle">We respect your privacy and are committed to protecting the information entrusted to us through our websites, apps, loyalty programs, and all related services.</p>
      </div>

      <section className="section legal-body">
        <div className="container legal-container">
          <p className="legal-intro">
            <strong>Habibi Halal Express, Inc.</strong> respects your privacy and is committed to protecting the information entrusted to us through our websites, mobile applications, wholesale ordering platforms, loyalty programs, gift card programs, SMS services, and related services (collectively, the "Services").
          </p>

          <div className="legal-sections">
            {sections.map(s => (
              <div key={s.title} className="legal-section">
                <div className="legal-section-hdr">
                  <span className="legal-section-icon">{s.icon}</span>
                  <h2 className="legal-section-title">{s.title}</h2>
                </div>
                {s.content && <p className="legal-section-body">{s.content}</p>}
                {s.list && (
                  <ul className="legal-list">
                    {s.list.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '3rem',
            background: 'linear-gradient(135deg,#0a0a0a 0%,#1a1209 100%)',
            border: '1px solid rgba(229,182,78,0.2)',
            borderRadius: 14,
            padding: '2rem',
            color: '#fff',
          }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E5B64E', fontWeight: 700, marginBottom: '1rem' }}>Privacy Questions</p>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>
              <strong style={{ color: '#fff' }}>Habibi Halal Express, Inc.</strong><br />
              {settings.address_street}, {settings.address_city}, {settings.address_state} {settings.address_zip}<br />
              Email: <a href={`mailto:${settings.email_contact}`} style={{ color: '#E5B64E' }}>{settings.email_contact}</a><br />
              Phone: <a href={`tel:+1${settings.phone_main.replace(/\D/g,'')}`} style={{ color: '#E5B64E' }}>{settings.phone_main}</a>
            </p>
          </div>

          <p className="legal-updated">
            Last updated: June 1, 2026 &nbsp;·&nbsp;
            <Link to="/terms">Terms of Service</Link> &nbsp;·&nbsp;
            <Link to="/sms-terms">SMS Terms</Link> &nbsp;·&nbsp;
            <Link to="/accessibility">Accessibility</Link> &nbsp;·&nbsp;
            <Link to="/contact">Contact Us</Link>
          </p>
        </div>
      </section>
    </>
  );
}
