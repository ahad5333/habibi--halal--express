import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    icon: '📲',
    title: 'How You Consent',
    content: 'By providing your mobile telephone number and affirmatively opting in through one or more approved methods, you consent to receive recurring automated and non-automated text messages from Habibi Halal Express, Inc. Consent may be obtained through account registration, mobile-application registration, checkout processes, loyalty-program enrollment, wholesale-account enrollment, promotional forms, website forms, customer-service interactions, or other approved consent mechanisms.',
  },
  {
    icon: '📨',
    title: 'Message Types',
    content: null,
    list: [
      'Order confirmations.',
      'Order updates.',
      'Pickup notifications.',
      'Delivery notifications.',
      'Customer-service communications.',
      'Account notifications.',
      'Security notifications.',
      'Marketing messages.',
      'Promotional offers.',
      'Coupons.',
      'Loyalty and rewards communications.',
      'Event announcements.',
      'Abandoned-cart reminders.',
      'Wholesale-account communications.',
      'Operational communications.',
    ],
  },
  {
    icon: '✅',
    title: 'Consent & Rates',
    content: 'Consent to receive text messages is not a condition of purchase. Message frequency may vary. Message and data rates may apply.',
  },
  {
    icon: '🛑',
    title: 'Opt-Out (STOP)',
    content: 'You may opt out at any time by replying STOP to any text message. After opting out, you may receive a final confirmation message confirming your request. You may re-enroll at any time by texting START or updating your notification preferences in your account settings.',
  },
  {
    icon: '❓',
    title: 'Help',
    content: null,
    detail: (
      <>
        For assistance, reply <strong>HELP</strong> or contact us at{' '}
        <a href="mailto:admin@habibihe.com" style={{ color: '#E5B64E' }}>admin@habibihe.com</a>{' '}
        or <a href="tel:7184000443" style={{ color: '#E5B64E' }}>(718) 400-0443</a>.
      </>
    ),
  },
  {
    icon: '📡',
    title: 'Carrier Disclaimer',
    content: 'Wireless carriers are not liable for delayed or undelivered messages. Message delivery is subject to network availability.',
  },
  {
    icon: '👤',
    title: 'Eligibility',
    content: 'You represent that you are the authorized user of the mobile telephone number provided and that you have authority to consent to receive communications at that number.',
  },
  {
    icon: '🔄',
    title: 'Modifications',
    content: 'Habibi Halal Express may modify, suspend, or terminate SMS programs at any time with or without notice.',
  },
  {
    icon: '🔒',
    title: 'Privacy',
    content: 'Information collected in connection with SMS programs is subject to the Company\'s Privacy Policy. We will not sell your mobile number to third parties for their own marketing purposes.',
  },
];

const SmsTerms = () => (
  <>
    <SEO
      title="SMS Terms & Conditions — Habibi Halal Express"
      description="SMS Terms and Conditions for Habibi Halal Express text message program. Learn about message frequency, opt-out instructions (STOP), and data rates."
    />

    <div className="legal-hero sms-hero">
      <div className="legal-hero-overlay" style={{ backgroundImage: "url('/images/legal/sms-terms-hero.jpg')", opacity: 0.18 }} />
      <div className="legal-hero-content">
        <p className="legal-eyebrow">Habibi Halal Express, INC.</p>
        <h1 className="legal-title">SMS Terms &amp; Conditions</h1>
        <p className="legal-subtitle">
          Everything you need to know about our text message program — how it works, how to opt out, and your rights.
        </p>
      </div>
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

export default SmsTerms;
