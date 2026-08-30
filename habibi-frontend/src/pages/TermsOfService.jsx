import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useSettings } from '../context/SettingsContext';
import { DOCS } from '../data/legalDocs';
import './LegalPage.css';

// Section content now lives in one place -- data/legalDocs.js -- shared with
// the /legal hub page and the signup/login LegalModal. This page used to
// hardcode its own copy of the same 23 sections, which could silently drift
// from the shared version over time. The intro paragraph and contact card
// below stay page-specific (they pull live settings.* values the shared
// data file can't access), only the legal section text itself is shared.
const sections = DOCS.terms.sections;

export default function TermsOfService() {
  const settings = useSettings();
  return (
    <>
      <SEO
        title="Terms of Service — Habibi Halal Express"
        description="Terms of Service for Habibi Halal Express. Read the terms governing your use of our website, mobile app, ordering, delivery, payments, and related services."
      />

      <div className="legal-hero">
        <picture>
          <source srcSet="/images/titles/terms-title.webp" type="image/webp" />
          <img src="/images/titles/terms-title.jpg" alt="Terms of Service — Habibi Halal Express" className="legal-hero-img" />
        </picture>
      </div>
      <div className="legal-hero-sub">
        <p className="legal-subtitle">These Terms govern your access to and use of our websites, mobile apps, ordering platform, delivery, payments, loyalty programs, and all related services.</p>
      </div>

      <section className="section legal-body">
        <div className="container legal-container">
          <p className="legal-intro">
            These Terms of Service ("Terms") govern your access to and use of the websites, mobile applications, wholesale ordering platforms, products, services, gift card programs, loyalty programs, SMS communications, and related offerings (collectively, the "Services") provided by <strong>Habibi Halal Express, Inc.</strong> By accessing or using any of our Services, you agree to be bound by these Terms. Questions may be directed to <a href={`mailto:${settings.email_contact}`} style={{ color: '#E5B64E' }}>{settings.email_contact}</a> or <a href={`tel:+1${settings.phone_main.replace(/\D/g,'')}`} style={{ color: '#E5B64E' }}>{settings.phone_main}</a>.
          </p>

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

          <div style={{
            marginTop: '3rem',
            background: 'linear-gradient(135deg,#0a0a0a 0%,#1a1209 100%)',
            border: '1px solid rgba(229,182,78,0.2)',
            borderRadius: 14,
            padding: '2rem',
            color: '#fff',
          }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E5B64E', fontWeight: 700, marginBottom: '1rem' }}>Contact Information</p>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>
              <strong style={{ color: '#fff' }}>Habibi Halal Express, Inc.</strong><br />
              {settings.address_street}, {settings.address_city}, {settings.address_state} {settings.address_zip}<br />
              Customer Service: <a href="mailto:habibi@habibihe.com" style={{ color: '#E5B64E' }}>habibi@habibihe.com</a><br />
              Legal &amp; Compliance: <a href={`mailto:${settings.email_contact}`} style={{ color: '#E5B64E' }}>{settings.email_contact}</a><br />
              Phone: <a href={`tel:+1${settings.phone_main.replace(/\D/g,'')}`} style={{ color: '#E5B64E' }}>{settings.phone_main}</a>
            </p>
          </div>

          <p className="legal-updated">
            Last updated: June 1, 2026 &nbsp;·&nbsp;
            <Link to="/privacy-policy">Privacy Policy</Link> &nbsp;·&nbsp;
            <Link to="/sms-terms">SMS Terms</Link> &nbsp;·&nbsp;
            <Link to="/accessibility">Accessibility</Link> &nbsp;·&nbsp;
            <Link to="/contact">Contact Us</Link>
          </p>
        </div>
      </section>
    </>
  );
}
