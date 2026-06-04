import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const Accessibility = () => (
  <>
    <SEO
      title="Accessibility Statement — Habibi Halal Express"
      description="Habibi Halal Express is committed to digital accessibility for all users. Learn about our accessibility features and how to contact us for assistance."
    />

    {/* Hero */}
    <div className="legal-hero accessibility-hero">
      <div className="legal-hero-overlay" style={{ backgroundImage: "url('/images/legal/accessibility-hero.jpg')", opacity: 0.18 }} />
      <div className="legal-hero-content">
        <p className="legal-eyebrow">Habibi Halal Express, INC.</p>
        <h1 className="legal-title">Accessibility Statement</h1>
        <p className="legal-subtitle">
          We are committed to making our website and app accessible to everyone, including people with disabilities.
        </p>
      </div>
    </div>

    <div className="legal-body">
      <div className="legal-container" style={{ padding: '3.5rem 1.5rem' }}>

        <p className="legal-intro">
          <strong>Habibi Halal Express, Inc.</strong> is committed to providing an accessible and inclusive experience for all customers, including individuals with disabilities. The Company strives to design, develop, and maintain its websites, mobile applications, wholesale platforms, and digital services in a manner that promotes accessibility, usability, and equal access.
        </p>

        <div className="legal-sections">

          <div className="legal-section">
            <div className="legal-section-hdr">
              <span className="legal-section-icon">🎯</span>
              <h2 className="legal-section-title">Our Commitment</h2>
            </div>
            <p className="legal-section-body">
              Habibi Halal Express continually works to improve accessibility through ongoing evaluation, testing, maintenance, and enhancement of digital properties. The Company endeavors to support commonly used assistive technologies and accessibility features, including screen readers, keyboard navigation, alternative text where appropriate, scalable text, and other accessibility tools.
            </p>
          </div>

          <div className="legal-section">
            <div className="legal-section-hdr">
              <span className="legal-section-icon">♿</span>
              <h2 className="legal-section-title">Assistive Technology Support</h2>
            </div>
            <p className="legal-section-body">
              Because technology continuously evolves, some content, features, or third-party integrations may not always function perfectly with every assistive technology. Habibi Halal Express welcomes feedback regarding accessibility barriers and opportunities for improvement.
            </p>
          </div>

          <div className="legal-section">
            <div className="legal-section-hdr">
              <span className="legal-section-icon">📣</span>
              <h2 className="legal-section-title">Feedback & Contact</h2>
            </div>
            <p className="legal-section-body">
              If you experience difficulty accessing any portion of the Services, require assistance, or wish to report an accessibility concern, please contact us. Habibi Halal Express will make reasonable efforts to address accessibility concerns and provide assistance where practicable.
            </p>
          </div>

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
              2974 Jerome Ave, Bronx, NY 10468<br />
              Email: <a href="mailto:admin@habibihe.com" style={{ color: '#E5B64E' }}>admin@habibihe.com</a><br />
              Phone: <a href="tel:7184000443" style={{ color: '#E5B64E' }}>(718) 400-0443</a>
            </p>
          </div>
        </div>

        <p className="legal-updated">
          Last updated: June 1, 2026 &nbsp;·&nbsp;
          <Link to="/privacy-policy">Privacy Policy</Link> &nbsp;·&nbsp;
          <Link to="/terms">Terms of Service</Link> &nbsp;·&nbsp;
          <Link to="/sms-terms">SMS Terms</Link> &nbsp;·&nbsp;
          <Link to="/contact">Contact Us</Link>
        </p>
      </div>
    </div>
  </>
);

export default Accessibility;
