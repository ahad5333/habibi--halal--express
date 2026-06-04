import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    icon: '✅',
    title: '1. Eligibility and Accounts',
    content: `You may create an account to access certain Services. You agree to provide accurate, current, and complete information and to keep such information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activities occurring under your account. The Company reserves the right to suspend, restrict, or terminate any account for any lawful reason, including fraud, abuse, chargeback misuse, promotional abuse, false reviews, harassment of employees, violations of these Terms, or suspected unlawful activity.`,
  },
  {
    icon: '📱',
    title: '2. Online Ordering',
    content: `Customers may place orders through Company websites, mobile applications, wholesale applications, approved third-party platforms, or other approved ordering methods. Orders are subject to acceptance and availability. The Company reserves the right to refuse, limit, cancel, or modify any order at its sole discretion.`,
  },
  {
    icon: '🏪',
    title: '3. Pickup Orders',
    content: `Customers may place pickup orders through approved Company platforms. Customers are responsible for collecting their orders within a reasonable period after notification that the order is ready. The Company is not responsible for food quality changes resulting from delayed pickup by the customer.`,
  },
  {
    icon: '🚗',
    title: '4. Delivery Orders',
    content: `The Company may fulfill deliveries through Company personnel, independent contractors, third-party delivery providers, or any fulfillment method selected by the Company. The Company reserves the right to determine the location preparing the order, the location fulfilling the order, the delivery method used, and the delivery provider used.\n\nDelivery times are estimates only and are not guaranteed. Food quality, temperature, freshness, and delivery times may be affected by distance, weather, traffic conditions, delivery-provider availability, operational demands, and other factors beyond the Company's control.\n\nThe Company shall not be liable for delays or failures resulting from events beyond its reasonable control, including weather, natural disasters, power outages, labor disputes, acts of government, internet failures, supply-chain disruptions, pandemics, or transportation interruptions.`,
  },
  {
    icon: '🍽️',
    title: '5. Catering Orders',
    content: `Catering services may be available only from participating locations. Availability, menu selections, pricing, minimum order requirements, and delivery options may vary by location. The Company reserves the right to refuse or cancel catering requests that cannot be reasonably fulfilled.`,
  },
  {
    icon: '💳',
    title: '6. Payments',
    content: `Accepted payment methods may include credit cards, debit cards, Apple Pay, Google Pay, PayPal, Zelle, Cash on Delivery (where available), and other approved payment methods. The Company reserves the right to add, remove, restrict, or modify accepted payment methods at any time. Customers authorize the Company and its payment processors to charge the selected payment method for all authorized purchases.`,
  },
  {
    icon: '↩️',
    title: '7. Refunds and Cancellations',
    content: `Orders may be canceled before preparation begins. Once an order has entered preparation, cooking, assembly, packaging, or fulfillment, cancellation requests may be denied. Refunds, replacements, credits, or other accommodations may be granted at the sole discretion of Habibi Halal Express or as otherwise required by law.\n\nIf an item becomes unavailable after an order is placed, the Company may cancel the affected item and issue a refund, cancel the entire order and issue a refund, or contact the customer regarding an alternative item. The Company reserves the right to cancel or correct orders affected by pricing errors, technical errors, software malfunctions, or inaccurate product descriptions.`,
  },
  {
    icon: '🎁',
    title: '8. Gift Cards',
    content: `Gift cards may be purchased and redeemed through participating locations and approved platforms. Gift cards have no cash value except where required by law, are not redeemable for cash except where required by law, and may not be replaceable if lost or stolen. Subject to applicable New York law, gift cards generally do not expire while Habibi Halal Express remains in operation.`,
  },
  {
    icon: '🏅',
    title: '9. Loyalty and Rewards Programs',
    content: `The Company may establish, modify, suspend, or terminate loyalty or rewards programs at any time. Rewards have no cash value, are not transferable, may not be sold, and may not be exchanged for cash. Rewards may be revoked for fraud, abuse, manipulation, promotional misuse, or violations of Company policies.`,
  },
  {
    icon: '⭐',
    title: '10. User Reviews and Content',
    content: `Customers may submit reviews, ratings, comments, photographs, and other content. By submitting content, you represent that you own or possess all necessary rights to the submitted material. You grant Habibi Halal Express a perpetual, worldwide, royalty-free, transferable license to use, reproduce, distribute, display, publish, modify, and promote submitted content. The Company reserves the right to remove content that is false, misleading, offensive, defamatory, illegal, fraudulent, spam, or otherwise inappropriate.`,
  },
  {
    icon: '⚠️',
    title: '11. Allergy and Food Safety Notice',
    content: `Although Habibi Halal Express strives to accommodate food allergies and dietary preferences, all food is prepared in facilities that may process common allergens. The Company cannot guarantee that any menu item is free from allergens, cross-contact, or cross-contamination. Customers with food allergies assume all risks associated with consumption.`,
  },
  {
    icon: '🏢',
    title: '12. Wholesale Accounts',
    content: `Certain business customers may receive customized account privileges, purchasing options, account benefits, or other commercial accommodations. Such arrangements are confidential, discretionary, and subject to modification, suspension, or termination by the Company at any time.`,
  },
  {
    icon: '🚫',
    title: '13. Prohibited Conduct',
    content: `You agree not to use the Services in any manner that violates applicable laws or regulations, interferes with the operation, security, or integrity of the Services, attempts to gain unauthorized access to accounts, systems, networks, or data, introduces malicious code or harmful content, collects or harvests information from the Services without authorization, impersonates any person or entity, misrepresents your identity or affiliation, or otherwise engages in conduct that may damage, disable, overburden, impair, or adversely affect the Services, the Company, its users, or its business operations.`,
  },
  {
    icon: '🤖',
    title: '14. Artificial Intelligence Features',
    content: `Certain Services may utilize artificial intelligence, machine learning, automation, recommendation engines, chat systems, customer-service tools, or related technologies. AI-generated information may occasionally contain inaccuracies, omissions, delays, or errors. Customers remain responsible for reviewing all order details and account information before relying upon them.`,
  },
  {
    icon: '🏥',
    title: '15. Health and Regulatory Compliance',
    content: `Company locations operate subject to applicable federal, state, and local laws and regulations, including inspections conducted by governmental authorities. Nothing contained within the Services shall be construed as a guarantee regarding inspection outcomes, ratings, certifications, or governmental approvals.`,
  },
  {
    icon: '🔄',
    title: '16. Chargebacks',
    content: `Customers are encouraged to contact Habibi Halal Express before initiating a chargeback so the Company may attempt to resolve concerns directly. Fraudulent, abusive, or improper chargebacks may result in account suspension, account termination, collection activity, recovery of costs, and legal action where permitted by law.`,
  },
  {
    icon: '©️',
    title: '17. Intellectual Property',
    content: `All content, materials, features, functionality, software, text, graphics, photographs, videos, trademarks, service marks, trade names, logos, branding, menu content, marketing materials, databases, designs, and other intellectual property made available through the Services are owned by or licensed to Habibi Halal Express, Inc. and are protected by applicable intellectual-property, copyright, trademark, and trade-secret laws.\n\nExcept as expressly authorized in writing by Habibi Halal Express, no portion of the Services may be copied, reproduced, modified, distributed, displayed, published, transmitted, sold, or otherwise used for commercial purposes. All rights not expressly granted herein are reserved by Habibi Halal Express, Inc.`,
  },
  {
    icon: '⚖️',
    title: '18. Disclaimer of Warranties',
    content: `The Services are provided on an "AS IS" and "AS AVAILABLE" basis to the maximum extent permitted by law. The Company disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.`,
  },
  {
    icon: '📉',
    title: '19. Limitation of Liability',
    content: `To the maximum extent permitted by law, Habibi Halal Express shall not be liable for indirect, incidental, special, consequential, punitive, or exemplary damages arising out of or relating to the Services.`,
  },
  {
    icon: '🔏',
    title: '20. Arbitration Agreement',
    content: `Any dispute arising out of or relating to the Services shall be resolved through binding individual arbitration. Arbitration shall take place in Bronx County, New York. Customers waive jury-trial rights, class-action participation, representative-action participation, and consolidated-action participation. Arbitration shall be administered pursuant to the applicable rules of the American Arbitration Association.\n\nCustomers may opt out of arbitration by providing written notice to admin@habibihe.com within thirty (30) days of first accepting these Terms.`,
  },
  {
    icon: '📍',
    title: '21. Governing Law',
    content: `These Terms shall be governed by the laws of the State of New York without regard to conflict-of-law principles.`,
  },
  {
    icon: '🛡️',
    title: '22. Indemnification',
    content: `You agree to defend, indemnify, and hold harmless Habibi Halal Express, Inc., its officers, directors, employees, affiliates, agents, licensors, and service providers from and against any claims, damages, liabilities, losses, costs, and expenses, including reasonable attorneys' fees, arising out of or relating to your use of the Services, violation of these Terms, submitted content, or violation of any law or rights of any third party.`,
  },
  {
    icon: '🔄',
    title: '23. Changes to These Terms',
    content: `The Company may modify these Terms at any time. Updated Terms will become effective upon posting unless otherwise stated. Continued use of the Services after changes are posted constitutes acceptance of the revised Terms. Material changes may be communicated through the Services, email, or other reasonable methods at the Company's discretion.`,
  },
];

export default function TermsOfService() {
  return (
    <>
      <SEO
        title="Terms of Service — Habibi Halal Express"
        description="Terms of Service for Habibi Halal Express. Read the terms governing your use of our website, mobile app, ordering, delivery, payments, and related services."
      />

      <div className="legal-hero">
        <div className="legal-hero-overlay" style={{ backgroundImage: "url('/images/legal/terms-hero.jpg')", opacity: 0.15 }} />
        <div className="legal-hero-content">
          <p className="legal-eyebrow">Habibi Halal Express, INC.</p>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">
            These Terms govern your access to and use of our websites, mobile apps, ordering platform, delivery, payments, loyalty programs, and all related services.
          </p>
        </div>
      </div>

      <section className="section legal-body">
        <div className="container legal-container">
          <p className="legal-intro">
            These Terms of Service ("Terms") govern your access to and use of the websites, mobile applications, wholesale ordering platforms, products, services, gift card programs, loyalty programs, SMS communications, and related offerings (collectively, the "Services") provided by <strong>Habibi Halal Express, Inc.</strong> By accessing or using any of our Services, you agree to be bound by these Terms. Questions may be directed to <a href="mailto:admin@habibihe.com" style={{ color: '#E5B64E' }}>admin@habibihe.com</a> or <a href="tel:7184000443" style={{ color: '#E5B64E' }}>(718) 400-0443</a>.
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
              2974 Jerome Ave, Bronx, NY 10468<br />
              Customer Service: <a href="mailto:habibi@habibihe.com" style={{ color: '#E5B64E' }}>habibi@habibihe.com</a><br />
              Legal &amp; Compliance: <a href="mailto:admin@habibihe.com" style={{ color: '#E5B64E' }}>admin@habibihe.com</a><br />
              Phone: <a href="tel:7184000443" style={{ color: '#E5B64E' }}>(718) 400-0443</a>
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
