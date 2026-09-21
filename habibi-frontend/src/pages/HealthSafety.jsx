import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useLegalDoc, RichText } from '../utils/legalText';
import './LegalPage.css';

// See TermsOfService.jsx's comment -- section content now sources from the
// shared data/legalDocs.js instead of a page-local hardcoded copy (this
// page's extra sentences that legalDocs.js's health entry was missing --
// allergen markers, temperature logs, driver training -- were merged into
// the shared data first, so it's now the more complete canonical version).
// The "Report a Concern" CTA button stays page-specific -- the shared /legal
// hub and signup/login modal don't need it, only this standalone page.

export default function HealthSafety() {
  const doc = useLegalDoc('health');
  const sections = doc.sections.map(s =>
    s.title === 'Report a Concern'
      ? { ...s, cta: { label: 'Contact Us', to: '/contact?type=complaint' } }
      : s
  );
  return (
    <>
      <SEO
        title="Our Standards — Habibi Halal Express"
        description="Learn about Habibi Halal Express's commitment to Halal certification, NYC Health Department A-rating, allergen handling, and kitchen hygiene standards."
        url="/health-safety"
      />

      <div className="legal-hero">
        <picture>
          <source srcSet="/images/titles/our-standards-title.webp" type="image/webp" />
          <img src="/images/titles/our-standards-title.jpg" alt="Our Standards — Habibi Halal Express" className="legal-hero-img" />
        </picture>
      </div>
      <div className="legal-hero-sub">
        <p className="legal-subtitle">{doc.subtitle}</p>
      </div>

      <section className="section legal-body">
        <div className="container legal-container">
          <p className="legal-intro"><RichText text={doc.intro} /></p>

          <div className="legal-sections">
            {sections.map(s => (
              <div key={s.title} className="legal-section">
                <div className="legal-section-hdr">
                  <span className="legal-section-icon">{s.icon}</span>
                  <h2 className="legal-section-title">{s.title}</h2>
                </div>
                <p className="legal-section-body" style={{ whiteSpace: 'pre-line' }}>{s.content}</p>
                {s.cta && (
                  <Link to={s.cta.to} className="btn btn-primary legal-cta-btn">
                    {s.cta.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="legal-updated">
            Last reviewed: {doc.updated} &nbsp;·&nbsp; <Link to="/contact">Report a concern</Link>
          </div>
        </div>
      </section>
    </>
  );
}
