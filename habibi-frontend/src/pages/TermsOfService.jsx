import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using the Habibi Halal Express website, mobile application, or any related services, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, please do not use our services.`,
  },
  {
    title: '2. Use of Our Services',
    content: `You may use our services only for lawful purposes and in accordance with these Terms. You agree not to use our services to place fraudulent orders, provide false information, or engage in any conduct that disrupts or harms our operations or other users.`,
  },
  {
    title: '3. Account Registration',
    content: `You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. Notify us immediately of any unauthorised use of your account.`,
  },
  {
    title: '4. Orders & Payment',
    content: `All orders are subject to acceptance and availability. Prices are listed in USD and are subject to change without notice. By placing an order, you agree to pay all applicable charges including the order subtotal, tax, service fee, delivery fee, and any tip. We reserve the right to cancel orders due to pricing errors, unavailability, or suspected fraud.`,
  },
  {
    title: '5. Delivery',
    content: `Delivery times are estimates and not guaranteed. We are not liable for delays caused by traffic, weather, or other circumstances beyond our control. If your order is not delivered, please contact us within 24 hours and we will investigate and offer a resolution.`,
  },
  {
    title: '6. Cancellations & Refunds',
    content: `Orders may be cancelled within 2 minutes of placement. Once food preparation has begun, cancellations are not accepted. Refunds are issued at our discretion for orders that are incorrect, missing items, or of unacceptable quality. All refund requests must be made within 24 hours of delivery.`,
  },
  {
    title: '7. Loyalty Points',
    content: `Loyalty points are awarded at our discretion and have no cash value outside of our platform. We reserve the right to modify, suspend, or terminate the loyalty programme at any time. Points expire after 12 months of account inactivity.`,
  },
  {
    title: '8. Intellectual Property',
    content: `All content on this website — including text, images, logos, and software — is the property of Habibi Halal Express, INC. and is protected by copyright. You may not reproduce, distribute, or create derivative works without our express written permission.`,
  },
  {
    title: '9. Limitation of Liability',
    content: `To the maximum extent permitted by law, Habibi Halal Express, INC. shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of our services. Our total liability for any claim shall not exceed the value of the order giving rise to the claim.`,
  },
  {
    title: '10. Governing Law',
    content: `These Terms are governed by the laws of the State of New York. Any disputes shall be resolved exclusively in the state or federal courts located in the Bronx, New York.`,
  },
  {
    title: '11. Changes to These Terms',
    content: `We may update these Terms at any time. Continued use of our services after changes are posted constitutes your acceptance of the revised Terms. We will notify registered users of material changes via email.`,
  },
  {
    title: '12. Contact',
    content: `For questions about these Terms, please contact us through our Contact page.`,
    cta: { label: 'Contact Us', to: '/contact' },
  },
];

export default function TermsOfService() {
  return (
    <>
      <SEO
        title="Terms of Service — Habibi Halal Express"
        description="Read the Habibi Halal Express Terms of Service governing the use of our website, app, ordering, delivery, payments, and loyalty programme."
        url="/terms"
      />

      <div className="legal-hero">
        <div className="legal-hero-overlay" />
        <div className="container legal-hero-content">
          <p className="legal-eyebrow">LEGAL</p>
          <h1 className="legal-title">Terms of <span className="text-primary">Service</span></h1>
          <p className="legal-subtitle">
            The rules that govern your use of Habibi Halal Express services.
          </p>
        </div>
      </div>

      <section className="section legal-body">
        <div className="container legal-container">
          <p className="legal-intro">
            Please read these Terms of Service carefully before using any Habibi Halal Express service. These Terms constitute a legally binding agreement between you and Habibi Halal Express, INC.
          </p>

          <div className="legal-sections">
            {sections.map(s => (
              <div key={s.title} className="legal-section">
                <div className="legal-section-hdr">
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
            Last updated: May 2026 &nbsp;·&nbsp; <Link to="/contact">Questions? Contact us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
