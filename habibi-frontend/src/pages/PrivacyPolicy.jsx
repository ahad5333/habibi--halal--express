import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    title: '1. Information We Collect',
    content: [
      'Account information: name, email address, phone number, and password (stored as a hashed value — we never store your plain-text password).',
      'Order information: delivery address, order history, payment method type (we do not store full card numbers — payments are processed by Stripe and PayPal).',
      'Device & usage data: IP address, browser type, pages visited, and time spent on each page — collected via Google Analytics and Facebook Pixel.',
      'Location data: approximate delivery location when you use our delivery fee calculator.',
      'Communications: any messages you send us through the Contact form, Urgent Request form, or live chat.',
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      'To process and fulfil your orders and send you order confirmations and status updates via email and SMS.',
      'To manage your account, loyalty points, saved addresses, and payment methods.',
      'To send you marketing emails and promotions — only if you have opted in. You can unsubscribe at any time.',
      'To improve our website, app, and service using aggregated analytics data.',
      'To comply with legal obligations and protect against fraud.',
    ],
  },
  {
    title: '3. Sharing Your Information',
    content: [
      'We do not sell your personal data to third parties.',
      'We share data with service providers who help us operate our business: Stripe (payments), PayPal (payments), Twilio (SMS), SendGrid (email), Google (analytics, maps), Firebase (push notifications), DoorDash / Roadie (delivery dispatch).',
      'All third-party processors are contractually required to handle your data securely and only for the purposes we specify.',
      'We may disclose data if required by law or to protect the rights and safety of Habibi Halal Express or its users.',
    ],
  },
  {
    title: '4. Cookies & Tracking',
    content: [
      'We use cookies to keep you logged in and remember your cart.',
      'Google Analytics uses cookies to collect anonymous usage statistics.',
      'Facebook Pixel collects data to measure the effectiveness of our advertising.',
      'You can disable cookies in your browser settings. Some features (like staying logged in) may not work without them.',
    ],
  },
  {
    title: '5. Data Retention',
    content: [
      'Account data is retained while your account is active and for up to 3 years after your last order.',
      'Order records are retained for 7 years to comply with financial and tax regulations.',
      'You may request deletion of your account at any time from your Account settings. We will anonymise your personal data while retaining order records for legal compliance.',
    ],
  },
  {
    title: '6. Your Rights',
    content: [
      'Access: you can view your profile, orders, and addresses at any time in your Account.',
      'Correction: you can update your name, email, phone, and address from your Account settings.',
      'Deletion: you can delete your account from Account → Profile → Delete Account.',
      'Opt-out of marketing: click the unsubscribe link in any marketing email, or contact us.',
      'Data portability: contact us to request a copy of your personal data.',
    ],
  },
  {
    title: '7. Children\'s Privacy',
    content: [
      'Our service is not directed at children under 13. We do not knowingly collect personal data from children. If you believe we have inadvertently collected data from a child, please contact us immediately.',
    ],
  },
  {
    title: '8. Security',
    content: [
      'All data is transmitted over HTTPS. Passwords are hashed with bcrypt. Payment card data is handled exclusively by Stripe and PayPal — we never see or store raw card numbers.',
      'We implement industry-standard security headers, rate limiting, and access controls to protect our systems.',
    ],
  },
  {
    title: '9. Contact',
    content: [
      'For privacy-related questions, requests, or concerns, please contact us through our Contact page or email privacy@habibihalal.com.',
    ],
    cta: { label: 'Contact Us', to: '/contact' },
  },
];

export default function PrivacyPolicy() {
  return (
    <>
      <SEO
        title="Privacy Policy — Habibi Halal Express"
        description="Read the Habibi Halal Express Privacy Policy to understand how we collect, use, and protect your personal information."
        url="/privacy-policy"
      />

      <div className="legal-hero">
        <div className="legal-hero-overlay" />
        <div className="container legal-hero-content">
          <p className="legal-eyebrow">LEGAL</p>
          <h1 className="legal-title">Privacy <span className="text-primary">Policy</span></h1>
          <p className="legal-subtitle">
            How we collect, use, and protect your personal information.
          </p>
        </div>
      </div>

      <section className="section legal-body">
        <div className="container legal-container">
          <p className="legal-intro">
            This Privacy Policy applies to the Habibi Halal Express website (habibihalal.com), mobile applications, and any related services operated by Habibi Halal Express, INC. By using our services you agree to the practices described here.
          </p>

          <div className="legal-sections">
            {sections.map(s => (
              <div key={s.title} className="legal-section">
                <div className="legal-section-hdr">
                  <h2 className="legal-section-title">{s.title}</h2>
                </div>
                <ul className="legal-list">
                  {s.content.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                {s.cta && (
                  <Link to={s.cta.to} className="btn btn-primary legal-cta-btn">
                    {s.cta.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="legal-updated">
            Last updated: May 2026 &nbsp;·&nbsp; <Link to="/contact">Questions? Contact us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
