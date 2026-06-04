import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    icon: '📋',
    title: 'Information We Collect',
    content: null,
    list: [
      'Account information: name, email address, telephone number, delivery address, billing address, payment information, loyalty-program information, account credentials, order history, communications with the Company, uploaded photographs, uploaded documents, and other information voluntarily provided by you.',
      'Device & technical data: device information, browser information, operating-system information, IP addresses, approximate and precise location information, application usage information, and other technical information relating to your use of the Services.',
      'Device feature access: the Services may request access to device features including location services, cameras, photo libraries, microphones, notifications, and related functionality.',
    ],
  },
  {
    icon: '🔧',
    title: 'How We Use Your Information',
    content: null,
    list: [
      'Process orders and payments.',
      'Fulfill pickup, delivery, catering, and wholesale transactions.',
      'Provide customer support.',
      'Administer loyalty and rewards programs.',
      'Provide gift card services.',
      'Send operational notifications.',
      'Send marketing and promotional communications.',
      'Improve products and services.',
      'Detect and prevent fraud.',
      'Comply with legal obligations.',
      'Support artificial-intelligence and automated-service features.',
      'Conduct analytics and business intelligence activities.',
    ],
  },
  {
    icon: '🍪',
    title: 'Cookies and Tracking Technologies',
    content: 'We may use cookies, pixels, tags, SDKs, and similar technologies to improve functionality, personalize content, analyze usage, measure advertising performance, and support marketing initiatives.',
  },
  {
    icon: '🔗',
    title: 'Third-Party Services',
    content: 'The Company may utilize third-party providers for payment processing, analytics, marketing, communications, delivery services, cloud hosting, customer support, and other business functions.',
  },
  {
    icon: '📊',
    title: 'Analytics and Advertising',
    content: 'The Services may utilize Google Analytics, Meta Pixel, Google Ads technologies, and similar tools to analyze traffic, measure performance, personalize experiences, and improve marketing effectiveness.',
  },
  {
    icon: '🤝',
    title: 'Data Sharing',
    content: 'We may share information with service providers, payment processors, delivery partners, technology vendors, advertising providers, analytics providers, professional advisors, affiliates, business partners, and governmental authorities where required by law. We do not sell your personal data to third parties for their own marketing purposes.',
  },
  {
    icon: '🔒',
    title: 'Data Security',
    content: 'We implement commercially reasonable administrative, technical, and physical safeguards intended to protect information from unauthorized access, disclosure, alteration, or destruction. No security system can guarantee absolute security.',
  },
  {
    icon: '👶',
    title: "Children's Privacy",
    content: 'The Services are not directed to children under thirteen (13) years of age. The Company does not knowingly collect personal information from children under thirteen (13).',
  },
  {
    icon: '🌍',
    title: 'International Users',
    content: 'Information may be processed and stored in the United States and other jurisdictions where the Company or its service providers operate.',
  },
  {
    icon: '🔄',
    title: 'Changes to This Policy',
    content: 'The Company may update this Privacy Policy at any time. Continued use of the Services constitutes acceptance of any revisions.',
  },
];

export default function PrivacyPolicy() {
  return (
    <>
      <SEO
        title="Privacy Policy — Habibi Halal Express"
        description="Privacy Policy for Habibi Halal Express. Learn how we collect, use, and protect your personal information across our website, app, and ordering services."
      />

      <div className="legal-hero">
        <div className="legal-hero-overlay" style={{ backgroundImage: "url('/images/legal/privacy-hero.jpg')", opacity: 0.15 }} />
        <div className="legal-hero-content">
          <p className="legal-eyebrow">Habibi Halal Express, INC.</p>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-subtitle">
            We respect your privacy and are committed to protecting the information entrusted to us through our websites, apps, loyalty programs, and all related services.
          </p>
        </div>
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
              2974 Jerome Ave, Bronx, NY 10468<br />
              Email: <a href="mailto:admin@habibihe.com" style={{ color: '#E5B64E' }}>admin@habibihe.com</a><br />
              Phone: <a href="tel:7184000443" style={{ color: '#E5B64E' }}>(718) 400-0443</a>
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
