import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    title: 'Halal Certification',
    icon: '🕌',
    content: `Every item on our menu is prepared exclusively with hand-slaughtered Zabiha Halal meat. Our suppliers are certified by recognised Halal certification bodies and audited annually. No pork, no alcohol, no cross-contamination — guaranteed.`,
  },
  {
    title: 'Food Safety Standards',
    icon: '🧪',
    content: `Habibi Halal Express maintains an A-rating from the NYC Department of Health and Mental Hygiene. Our kitchen undergoes scheduled health inspections and we voluntarily conduct internal audits every 30 days. All staff hold valid Food Handler Certificates.`,
  },
  {
    title: 'Allergen Information',
    icon: '⚠️',
    content: `Our kitchen handles gluten, dairy, sesame, tree nuts, and soy. While we take precautions, we cannot guarantee a completely allergen-free environment. Items marked 🌾 Gluten Free and 🥗 Vegetarian are prepared with additional care. Please notify us of any allergies when placing your order — we will do our utmost to accommodate you safely.`,
  },
  {
    title: 'Kitchen Hygiene',
    icon: '🧼',
    content: `All preparation surfaces are sanitised between every service. Staff are required to wash hands every 30 minutes, after handling raw proteins, and after any break. Single-use gloves are worn for all ready-to-eat food contact. Temperature logs are maintained for every refrigeration and hot-holding unit throughout the day.`,
  },
  {
    title: 'Delivery & Packaging Safety',
    icon: '📦',
    content: `All delivery packaging is food-grade and tamper-evident. Hot items are sealed and bagged separately from cold items. Our drivers are trained in safe food transport procedures. If your order arrives damaged, unsealed, or at an unacceptable temperature, please contact us immediately for a replacement.`,
  },
  {
    title: 'COVID-19 & Illness Policy',
    icon: '🛡️',
    content: `Any team member showing symptoms of illness is immediately relieved from kitchen duties. We follow CDC guidelines and NYC Department of Health directives on food handler illness. Contactless delivery and pickup options remain available at all times.`,
  },
  {
    title: 'Report a Concern',
    icon: '📞',
    content: `Your safety is our highest priority. If you have a concern about food safety, allergen labelling, or hygiene standards, please contact us immediately. We investigate every report within 24 hours.`,
    cta: { label: 'Contact Us', to: '/contact?type=complaint' },
  },
];

export default function HealthSafety() {
  return (
    <>
      <SEO
        title="Health & Safety — Habibi Halal Express"
        description="Learn about Habibi Halal Express's commitment to Halal certification, NYC Health Department A-rating, allergen handling, and kitchen hygiene standards."
        url="/health-safety"
      />

      <div className="legal-hero">
        <div className="legal-hero-overlay" />
        <div className="container legal-hero-content">
          <p className="legal-eyebrow">OUR STANDARDS</p>
          <h1 className="legal-title">Health <span className="text-primary">&amp;</span> Safety</h1>
          <p className="legal-subtitle">
            Certified Halal. NYC Health A-Rated. Transparent from farm to table.
          </p>
        </div>
      </div>

      <section className="section legal-body">
        <div className="container legal-container">
          <p className="legal-intro">
            At Habibi Halal Express we believe that exceptional food must begin with uncompromising safety. Below is a full account of the standards we hold ourselves to every single day.
          </p>

          <div className="legal-sections">
            {sections.map(s => (
              <div key={s.title} className="legal-section">
                <div className="legal-section-hdr">
                  <span className="legal-section-icon">{s.icon}</span>
                  <h2 className="legal-section-title">{s.title}</h2>
                </div>
                <p className="legal-section-body">{s.content}</p>
                {s.cta && (
                  <Link to={s.cta.to} className="btn btn-primary legal-cta-btn">
                    {s.cta.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="legal-updated">
            Last reviewed: May 2026 &nbsp;·&nbsp; <Link to="/contact">Report a concern</Link>
          </div>
        </div>
      </section>
    </>
  );
}
