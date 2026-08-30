import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useSettings } from '../context/SettingsContext';
import { DOCS } from '../data/legalDocs';
import './LegalPage.css';

const SmsTerms = () => {
  const settings = useSettings();

  // See TermsOfService.jsx's comment -- section content now sources from the
  // shared data/legalDocs.js instead of a page-local hardcoded copy. One
  // exception: "Help" swaps in a live settings-driven contact link (the
  // shared data file can't reach useSettings()), same info either way.
  const sections = DOCS.sms.sections.map(s =>
    s.title === 'Help'
      ? {
          ...s,
          detail: (
            <>
              For assistance, reply <strong>HELP</strong> or contact us at{' '}
              <a href={`mailto:${settings.email_contact}`} style={{ color: '#E5B64E' }}>{settings.email_contact}</a>{' '}
              or <a href={`tel:+1${settings.phone_main.replace(/\D/g,'')}`} style={{ color: '#E5B64E' }}>{settings.phone_main}</a>.
            </>
          ),
        }
      : s
  );

  return (
    <>
      <SEO
        title="SMS Terms & Conditions — Habibi Halal Express"
        description="SMS Terms and Conditions for Habibi Halal Express text message program. Learn about message frequency, opt-out instructions (STOP), and data rates."
      />

      <div className="legal-hero">
        <picture>
          <source srcSet="/images/titles/sms-terms-title.webp" type="image/webp" />
          <img src="/images/titles/sms-terms-title.jpg" alt="SMS Terms and Conditions — Habibi Halal Express" className="legal-hero-img" />
        </picture>
      </div>
      <div className="legal-hero-sub">
        <p className="legal-subtitle">Everything you need to know about our text message program, how it works, how to opt out, and your rights.</p>
      </div>

      <div className="legal-body">
        <div className="legal-container" style={{ padding: '3.5rem 1.5rem' }}>

          <p className="legal-intro">
            By providing your phone number and opting into SMS communications from Habibi Halal Express, you agree to these SMS Terms &amp; Conditions.{' '}
            <strong>Consent is not a condition of purchase.</strong> Message and data rates may apply. Reply <strong>STOP</strong> to opt out at any time. Reply <strong>HELP</strong> for assistance.
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
                {s.detail && <p className="legal-section-body">{s.detail}</p>}
              </div>
            ))}
          </div>

          {/* Quick reference */}
          <div style={{
            marginTop: '3rem',
            background: 'linear-gradient(135deg,#0a0a0a 0%,#1a1209 100%)',
            border: '1px solid rgba(229,182,78,0.25)',
            borderRadius: 14,
            padding: '2rem',
            color: '#fff',
          }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E5B64E', fontWeight: 700, marginBottom: '1rem' }}>
              Quick Reference
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '1rem' }}>
              {[
                { cmd: 'STOP',  desc: 'Opt out of all messages' },
                { cmd: 'HELP',  desc: 'Get support information' },
                { cmd: 'START', desc: 'Re-enroll in messages' },
              ].map(r => (
                <div key={r.cmd} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E5B64E', marginBottom: '0.25rem' }}>{r.cmd}</p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="legal-updated">
            Last updated: June 1, 2026 &nbsp;·&nbsp;
            <Link to="/privacy-policy">Privacy Policy</Link> &nbsp;·&nbsp;
            <Link to="/terms">Terms of Service</Link> &nbsp;·&nbsp;
            <Link to="/contact">Contact Us</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default SmsTerms;
