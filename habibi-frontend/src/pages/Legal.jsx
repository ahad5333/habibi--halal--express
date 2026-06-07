import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Shield, Clock, MapPin, Mail, Phone } from 'lucide-react';
import SEO from '../components/SEO';
import './Legal.css';

/* ── Document catalogue ───────────────────────────────────────── */
const DOC_LIST = [
  { id: 'terms',         icon: '📋', label: 'Terms of Service',    desc: 'Usage, orders, payments & liability'     },
  { id: 'privacy',       icon: '🔏', label: 'Privacy Policy',       desc: 'Data collection, usage & your rights'    },
  { id: 'sms',           icon: '📲', label: 'SMS Terms',            desc: 'Text messages, consent & opt-out'        },
  { id: 'accessibility', icon: '♿', label: 'Accessibility',         desc: 'Our commitment to all users'             },
  { id: 'health',        icon: '🏥', label: 'Health & Safety',       desc: 'Halal cert, allergens & kitchen hygiene' },
];

/* ── All document content ─────────────────────────────────────── */
const DOCS = {
  terms: {
    label: 'Terms of Service',
    icon: '📋',
    subtitle: 'These Terms govern your access to and use of our websites, mobile apps, ordering platform, delivery, payments, loyalty programs, and all related services.',
    updated: 'June 1, 2026',
    intro: 'These Terms of Service ("Terms") govern your access to and use of the websites, mobile applications, wholesale ordering platforms, products, services, gift card programs, loyalty programs, SMS communications, and related offerings (collectively, the "Services") provided by Habibi Halal Express, Inc. By accessing or using any of our Services, you agree to be bound by these Terms. Questions may be directed to admin@habibihe.com or (718) 400-0443.',
    sections: [
      { icon: '✅', title: '1. Eligibility and Accounts', content: 'You may create an account to access certain Services. You agree to provide accurate, current, and complete information and to keep such information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activities occurring under your account. The Company reserves the right to suspend, restrict, or terminate any account for any lawful reason, including fraud, abuse, chargeback misuse, promotional abuse, false reviews, harassment of employees, violations of these Terms, or suspected unlawful activity.' },
      { icon: '📱', title: '2. Online Ordering', content: 'Customers may place orders through Company websites, mobile applications, wholesale applications, approved third-party platforms, or other approved ordering methods. Orders are subject to acceptance and availability. The Company reserves the right to refuse, limit, cancel, or modify any order at its sole discretion.' },
      { icon: '🏪', title: '3. Pickup Orders', content: 'Customers may place pickup orders through approved Company platforms. Customers are responsible for collecting their orders within a reasonable period after notification that the order is ready. The Company is not responsible for food quality changes resulting from delayed pickup by the customer.' },
      { icon: '🚗', title: '4. Delivery Orders', content: 'The Company may fulfill deliveries through Company personnel, independent contractors, third-party delivery providers, or any fulfillment method selected by the Company. The Company reserves the right to determine the location preparing the order, the location fulfilling the order, the delivery method used, and the delivery provider used.\n\nDelivery times are estimates only and are not guaranteed. Food quality, temperature, freshness, and delivery times may be affected by distance, weather, traffic conditions, delivery-provider availability, operational demands, and other factors beyond the Company\'s control.\n\nThe Company shall not be liable for delays or failures resulting from events beyond its reasonable control, including weather, natural disasters, power outages, labor disputes, acts of government, internet failures, supply-chain disruptions, pandemics, or transportation interruptions.' },
      { icon: '🍽️', title: '5. Catering Orders', content: 'Catering services may be available only from participating locations. Availability, menu selections, pricing, minimum order requirements, and delivery options may vary by location. The Company reserves the right to refuse or cancel catering requests that cannot be reasonably fulfilled.' },
      { icon: '💳', title: '6. Payments', content: 'Accepted payment methods may include credit cards, debit cards, Apple Pay, Google Pay, PayPal, Zelle, Cash on Delivery (where available), and other approved payment methods. The Company reserves the right to add, remove, restrict, or modify accepted payment methods at any time. Customers authorize the Company and its payment processors to charge the selected payment method for all authorized purchases.' },
      { icon: '↩️', title: '7. Refunds and Cancellations', content: 'Orders may be canceled before preparation begins. Once an order has entered preparation, cooking, assembly, packaging, or fulfillment, cancellation requests may be denied. Refunds, replacements, credits, or other accommodations may be granted at the sole discretion of Habibi Halal Express or as otherwise required by law.\n\nIf an item becomes unavailable after an order is placed, the Company may cancel the affected item and issue a refund, cancel the entire order and issue a refund, or contact the customer regarding an alternative item. The Company reserves the right to cancel or correct orders affected by pricing errors, technical errors, software malfunctions, or inaccurate product descriptions.' },
      { icon: '🎁', title: '8. Gift Cards', content: 'Gift cards may be purchased and redeemed through participating locations and approved platforms. Gift cards have no cash value except where required by law, are not redeemable for cash except where required by law, and may not be replaceable if lost or stolen. Subject to applicable New York law, gift cards generally do not expire while Habibi Halal Express remains in operation.' },
      { icon: '🏅', title: '9. Loyalty and Rewards Programs', content: 'The Company may establish, modify, suspend, or terminate loyalty or rewards programs at any time. Rewards have no cash value, are not transferable, may not be sold, and may not be exchanged for cash. Rewards may be revoked for fraud, abuse, manipulation, promotional misuse, or violations of Company policies.' },
      { icon: '⭐', title: '10. User Reviews and Content', content: 'Customers may submit reviews, ratings, comments, photographs, and other content. By submitting content, you represent that you own or possess all necessary rights to the submitted material. You grant Habibi Halal Express a perpetual, worldwide, royalty-free, transferable license to use, reproduce, distribute, display, publish, modify, and promote submitted content. The Company reserves the right to remove content that is false, misleading, offensive, defamatory, illegal, fraudulent, spam, or otherwise inappropriate.' },
      { icon: '⚠️', title: '11. Allergy and Food Safety Notice', content: 'Although Habibi Halal Express strives to accommodate food allergies and dietary preferences, all food is prepared in facilities that may process common allergens. The Company cannot guarantee that any menu item is free from allergens, cross-contact, or cross-contamination. Customers with food allergies assume all risks associated with consumption.' },
      { icon: '🏢', title: '12. Wholesale Accounts', content: 'Certain business customers may receive customized account privileges, purchasing options, account benefits, or other commercial accommodations. Such arrangements are confidential, discretionary, and subject to modification, suspension, or termination by the Company at any time.' },
      { icon: '🚫', title: '13. Prohibited Conduct', content: 'You agree not to use the Services in any manner that violates applicable laws or regulations, interferes with the operation, security, or integrity of the Services, attempts to gain unauthorized access to accounts, systems, networks, or data, introduces malicious code or harmful content, collects or harvests information from the Services without authorization, impersonates any person or entity, misrepresents your identity or affiliation, or otherwise engages in conduct that may damage, disable, overburden, impair, or adversely affect the Services, the Company, its users, or its business operations.' },
      { icon: '🤖', title: '14. Artificial Intelligence Features', content: 'Certain Services may utilize artificial intelligence, machine learning, automation, recommendation engines, chat systems, customer-service tools, or related technologies. AI-generated information may occasionally contain inaccuracies, omissions, delays, or errors. Customers remain responsible for reviewing all order details and account information before relying upon them.' },
      { icon: '🏥', title: '15. Health and Regulatory Compliance', content: 'Company locations operate subject to applicable federal, state, and local laws and regulations, including inspections conducted by governmental authorities. Nothing contained within the Services shall be construed as a guarantee regarding inspection outcomes, ratings, certifications, or governmental approvals.' },
      { icon: '🔄', title: '16. Chargebacks', content: 'Customers are encouraged to contact Habibi Halal Express before initiating a chargeback so the Company may attempt to resolve concerns directly. Fraudulent, abusive, or improper chargebacks may result in account suspension, account termination, collection activity, recovery of costs, and legal action where permitted by law.' },
      { icon: '©️', title: '17. Intellectual Property', content: 'All content, materials, features, functionality, software, text, graphics, photographs, videos, trademarks, service marks, trade names, logos, branding, menu content, marketing materials, databases, designs, and other intellectual property made available through the Services are owned by or licensed to Habibi Halal Express, Inc. and are protected by applicable intellectual-property, copyright, trademark, and trade-secret laws.\n\nExcept as expressly authorized in writing by Habibi Halal Express, no portion of the Services may be copied, reproduced, modified, distributed, displayed, published, transmitted, sold, or otherwise used for commercial purposes. All rights not expressly granted herein are reserved by Habibi Halal Express, Inc.' },
      { icon: '⚖️', title: '18. Disclaimer of Warranties', content: 'The Services are provided on an "AS IS" and "AS AVAILABLE" basis to the maximum extent permitted by law. The Company disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.' },
      { icon: '📉', title: '19. Limitation of Liability', content: 'To the maximum extent permitted by law, Habibi Halal Express shall not be liable for indirect, incidental, special, consequential, punitive, or exemplary damages arising out of or relating to the Services.' },
      { icon: '🔏', title: '20. Arbitration Agreement', content: 'Any dispute arising out of or relating to the Services shall be resolved through binding individual arbitration. Arbitration shall take place in Bronx County, New York. Customers waive jury-trial rights, class-action participation, representative-action participation, and consolidated-action participation. Arbitration shall be administered pursuant to the applicable rules of the American Arbitration Association.\n\nCustomers may opt out of arbitration by providing written notice to admin@habibihe.com within thirty (30) days of first accepting these Terms.' },
      { icon: '📍', title: '21. Governing Law', content: 'These Terms shall be governed by the laws of the State of New York without regard to conflict-of-law principles.' },
      { icon: '🛡️', title: '22. Indemnification', content: 'You agree to defend, indemnify, and hold harmless Habibi Halal Express, Inc., its officers, directors, employees, affiliates, agents, licensors, and service providers from and against any claims, damages, liabilities, losses, costs, and expenses, including reasonable attorneys\' fees, arising out of or relating to your use of the Services, violation of these Terms, submitted content, or violation of any law or rights of any third party.' },
      { icon: '🔄', title: '23. Changes to These Terms', content: 'The Company may modify these Terms at any time. Updated Terms will become effective upon posting unless otherwise stated. Continued use of the Services after changes are posted constitutes acceptance of the revised Terms. Material changes may be communicated through the Services, email, or other reasonable methods at the Company\'s discretion.' },
    ],
  },

  privacy: {
    label: 'Privacy Policy',
    icon: '🔏',
    subtitle: 'We respect your privacy and are committed to protecting the information entrusted to us through our websites, apps, loyalty programs, and all related services.',
    updated: 'June 1, 2026',
    intro: 'Habibi Halal Express, Inc. respects your privacy and is committed to protecting the information entrusted to us through our websites, mobile applications, wholesale ordering platforms, loyalty programs, gift card programs, SMS services, and related services (collectively, the "Services").',
    sections: [
      { icon: '📋', title: 'Information We Collect', list: ['Account information: name, email address, telephone number, delivery address, billing address, payment information, loyalty-program information, account credentials, order history, communications with the Company, uploaded photographs, uploaded documents, and other information voluntarily provided by you.', 'Device & technical data: device information, browser information, operating-system information, IP addresses, approximate and precise location information, application usage information, and other technical information relating to your use of the Services.', 'Device feature access: the Services may request access to device features including location services, cameras, photo libraries, microphones, notifications, and related functionality.'] },
      { icon: '🔧', title: 'How We Use Your Information', list: ['Process orders and payments.', 'Fulfill pickup, delivery, catering, and wholesale transactions.', 'Provide customer support.', 'Administer loyalty and rewards programs.', 'Provide gift card services.', 'Send operational notifications.', 'Send marketing and promotional communications.', 'Improve products and services.', 'Detect and prevent fraud.', 'Comply with legal obligations.', 'Support artificial-intelligence and automated-service features.', 'Conduct analytics and business intelligence activities.'] },
      { icon: '🍪', title: 'Cookies and Tracking Technologies', content: 'We may use cookies, pixels, tags, SDKs, and similar technologies to improve functionality, personalize content, analyze usage, measure advertising performance, and support marketing initiatives.' },
      { icon: '🔗', title: 'Third-Party Services', content: 'The Company may utilize third-party providers for payment processing, analytics, marketing, communications, delivery services, cloud hosting, customer support, and other business functions.' },
      { icon: '📊', title: 'Analytics and Advertising', content: 'The Services may utilize Google Analytics, Meta Pixel, Google Ads technologies, and similar tools to analyze traffic, measure performance, personalize experiences, and improve marketing effectiveness.' },
      { icon: '🤝', title: 'Data Sharing', content: 'We may share information with service providers, payment processors, delivery partners, technology vendors, advertising providers, analytics providers, professional advisors, affiliates, business partners, and governmental authorities where required by law. We do not sell your personal data to third parties for their own marketing purposes.' },
      { icon: '🔒', title: 'Data Security', content: 'We implement commercially reasonable administrative, technical, and physical safeguards intended to protect information from unauthorized access, disclosure, alteration, or destruction. No security system can guarantee absolute security.' },
      { icon: '👶', title: "Children's Privacy", content: 'The Services are not directed to children under thirteen (13) years of age. The Company does not knowingly collect personal information from children under thirteen (13).' },
      { icon: '🌍', title: 'International Users', content: 'Information may be processed and stored in the United States and other jurisdictions where the Company or its service providers operate.' },
      { icon: '🔄', title: 'Changes to This Policy', content: 'The Company may update this Privacy Policy at any time. Continued use of the Services constitutes acceptance of any revisions.' },
    ],
  },

  sms: {
    label: 'SMS Terms & Conditions',
    icon: '📲',
    subtitle: 'Everything you need to know about our text message program — how it works, how to opt out, and your rights.',
    updated: 'June 1, 2026',
    intro: 'By providing your phone number and opting into SMS communications from Habibi Halal Express, you agree to these SMS Terms & Conditions. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for assistance.',
    sections: [
      { icon: '📲', title: 'How You Consent', content: 'By providing your mobile telephone number and affirmatively opting in through one or more approved methods, you consent to receive recurring automated and non-automated text messages from Habibi Halal Express, Inc. Consent may be obtained through account registration, mobile-application registration, checkout processes, loyalty-program enrollment, wholesale-account enrollment, promotional forms, website forms, customer-service interactions, or other approved consent mechanisms.' },
      { icon: '📨', title: 'Message Types', list: ['Order confirmations.', 'Order updates.', 'Pickup notifications.', 'Delivery notifications.', 'Customer-service communications.', 'Account notifications.', 'Security notifications.', 'Marketing messages.', 'Promotional offers.', 'Coupons.', 'Loyalty and rewards communications.', 'Event announcements.', 'Abandoned-cart reminders.', 'Wholesale-account communications.', 'Operational communications.'] },
      { icon: '✅', title: 'Consent & Rates', content: 'Consent to receive text messages is not a condition of purchase. Message frequency may vary. Message and data rates may apply.' },
      { icon: '🛑', title: 'Opt-Out (STOP)', content: 'You may opt out at any time by replying STOP to any text message. After opting out, you may receive a final confirmation message confirming your request. You may re-enroll at any time by texting START or updating your notification preferences in your account settings.' },
      { icon: '❓', title: 'Help', content: 'For assistance, reply HELP or contact us at admin@habibihe.com or (718) 400-0443.' },
      { icon: '📡', title: 'Carrier Disclaimer', content: 'Wireless carriers are not liable for delayed or undelivered messages. Message delivery is subject to network availability.' },
      { icon: '👤', title: 'Eligibility', content: 'You represent that you are the authorized user of the mobile telephone number provided and that you have authority to consent to receive communications at that number.' },
      { icon: '🔄', title: 'Modifications', content: 'Habibi Halal Express may modify, suspend, or terminate SMS programs at any time with or without notice.' },
      { icon: '🔒', title: 'Privacy', content: "Information collected in connection with SMS programs is subject to the Company's Privacy Policy. We will not sell your mobile number to third parties for their own marketing purposes." },
    ],
  },

  accessibility: {
    label: 'Accessibility Statement',
    icon: '♿',
    subtitle: 'We are committed to making our website and app accessible to everyone, including people with disabilities.',
    updated: 'June 1, 2026',
    intro: 'Habibi Halal Express, Inc. is committed to providing an accessible and inclusive experience for all customers, including individuals with disabilities. The Company strives to design, develop, and maintain its websites, mobile applications, wholesale platforms, and digital services in a manner that promotes accessibility, usability, and equal access.',
    sections: [
      { icon: '🎯', title: 'Our Commitment', content: 'Habibi Halal Express continually works to improve accessibility through ongoing evaluation, testing, maintenance, and enhancement of digital properties. The Company endeavors to support commonly used assistive technologies and accessibility features, including screen readers, keyboard navigation, alternative text where appropriate, scalable text, and other accessibility tools.' },
      { icon: '♿', title: 'Assistive Technology Support', content: 'Because technology continuously evolves, some content, features, or third-party integrations may not always function perfectly with every assistive technology. Habibi Halal Express welcomes feedback regarding accessibility barriers and opportunities for improvement.' },
      { icon: '📣', title: 'Feedback & Contact', content: 'If you experience difficulty accessing any portion of the Services, require assistance, or wish to report an accessibility concern, please contact us. Habibi Halal Express will make reasonable efforts to address accessibility concerns and provide assistance where practicable.' },
    ],
  },

  health: {
    label: 'Health & Safety',
    icon: '🏥',
    subtitle: 'Certified Halal. NYC Health A-Rated. Transparent from farm to table.',
    updated: 'June 1, 2026',
    intro: 'Habibi Halal Express maintains the highest standards of food safety, halal certification, and kitchen hygiene across all locations. Our commitment to your health and safety is unwavering.',
    sections: [
      { icon: '🕌', title: 'Halal Certification', content: 'Every item on our menu is prepared exclusively with hand-slaughtered Zabiha Halal meat. Our suppliers are certified by recognised Halal certification bodies and audited annually. No pork, no alcohol, no cross-contamination — guaranteed.' },
      { icon: '🧪', title: 'Food Safety Standards', content: 'Habibi Halal Express maintains an A-rating from the NYC Department of Health and Mental Hygiene. Our kitchen undergoes scheduled health inspections and we voluntarily conduct internal audits every 30 days. All staff hold valid Food Handler Certificates.' },
      { icon: '⚠️', title: 'Allergen Information', content: 'Our kitchen handles gluten, dairy, sesame, tree nuts, and soy. While we take precautions, we cannot guarantee a completely allergen-free environment. Items marked 🌾 Gluten Free and 🥗 Vegetarian are prepared with additional care. Please notify us of any allergies when placing your order — we will do our utmost to accommodate you safely.' },
      { icon: '🧼', title: 'Kitchen Hygiene', content: 'All preparation surfaces are sanitised between every service. Staff are required to wash hands every 30 minutes, after handling raw proteins, and after any break. Single-use gloves are worn for all ready-to-eat food contact. Temperature logs are maintained for every refrigeration and hot-holding unit throughout the day.' },
      { icon: '📦', title: 'Delivery & Packaging Safety', content: 'All delivery packaging is food-grade and tamper-evident. Hot items are sealed and bagged separately from cold items. Our drivers are trained in safe food transport procedures. If your order arrives damaged, unsealed, or at an unacceptable temperature, please contact us immediately for a replacement.' },
      { icon: '🛡️', title: 'COVID-19 & Illness Policy', content: 'Any team member showing symptoms of illness is immediately relieved from kitchen duties. We follow CDC guidelines and NYC Department of Health directives on food handler illness. Contactless delivery and pickup options remain available at all times.' },
      { icon: '📞', title: 'Report a Concern', content: 'Your safety is our highest priority. If you have a concern about food safety, allergen labelling, or hygiene standards, please contact us immediately. We investigate every report within 24 hours.' },
    ],
  },
};

/* ── Section renderer ─────────────────────────────────────────── */
function Section({ s }) {
  return (
    <div className="lh-section">
      <div className="lh-section-hdr">
        <span className="lh-section-icon">{s.icon}</span>
        <h2 className="lh-section-title">{s.title}</h2>
      </div>
      {s.content && (
        <p className="lh-section-body" style={{ whiteSpace: 'pre-line' }}>{s.content}</p>
      )}
      {s.list && (
        <ul className="lh-list">
          {s.list.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function Legal() {
  const [params, setParams] = useSearchParams();
  const activeId = DOC_LIST.some(d => d.id === params.get('doc')) ? params.get('doc') : 'terms';
  const doc = DOCS[activeId];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeId]);

  const switchDoc = (id) => setParams({ doc: id });

  return (
    <>
      <SEO
        title={`${doc.label} — Habibi Halal Express Legal Center`}
        description={doc.intro.substring(0, 155)}
      />

      <div className="legal-hub">

        {/* ── Left sidebar ── */}
        <aside className="lh-sidebar">
          <div className="lh-brand">
            <div className="lh-brand-icon"><Shield size={20} /></div>
            <div>
              <p className="lh-brand-name">Legal Center</p>
              <p className="lh-brand-sub">Habibi Halal Express</p>
            </div>
          </div>

          <nav className="lh-nav">
            {DOC_LIST.map(d => (
              <button
                key={d.id}
                className={`lh-nav-item ${d.id === activeId ? 'active' : ''}`}
                onClick={() => switchDoc(d.id)}
              >
                <span className="lh-nav-icon">{d.icon}</span>
                <div className="lh-nav-text">
                  <p className="lh-nav-label">{d.label}</p>
                  <p className="lh-nav-desc">{d.desc}</p>
                </div>
                {d.id === activeId && <span className="lh-nav-dot" />}
              </button>
            ))}
          </nav>

          <div className="lh-sidebar-footer">
            <p className="lh-footer-label">Questions?</p>
            <a href="mailto:admin@habibihe.com" className="lh-footer-link">
              <Mail size={13} /> admin@habibihe.com
            </a>
            <a href="tel:7184000443" className="lh-footer-link">
              <Phone size={13} /> (718) 400-0443
            </a>
            <a href="https://maps.google.com/?q=2974+Jerome+Ave+Bronx+NY" target="_blank" rel="noreferrer" className="lh-footer-link">
              <MapPin size={13} /> 2974 Jerome Ave, Bronx NY
            </a>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="lh-main">

          {/* Document header */}
          <div className="lh-doc-header">
            <div className="lh-doc-header-glow" />
            <div className="lh-doc-header-inner">
              <span className="lh-doc-big-icon">{doc.icon}</span>
              <div>
                <p className="lh-doc-eyebrow">Habibi Halal Express, Inc.</p>
                <h1 className="lh-doc-title">{doc.label}</h1>
                <p className="lh-doc-subtitle">{doc.subtitle}</p>
                <div className="lh-doc-meta">
                  <span><Clock size={13} /> Last updated: {doc.updated}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Document body */}
          <div className="lh-body">

            {/* Intro */}
            <p className="lh-intro">{doc.intro}</p>

            {/* SMS quick-ref banner */}
            {activeId === 'sms' && (
              <div className="lh-sms-banner">
                <p className="lh-sms-banner-label">Quick Reference</p>
                <div className="lh-sms-cmds">
                  {[{ cmd: 'STOP', desc: 'Opt out of all messages' }, { cmd: 'HELP', desc: 'Get support information' }, { cmd: 'START', desc: 'Re-enroll in messages' }].map(r => (
                    <div key={r.cmd} className="lh-sms-cmd">
                      <p className="lh-sms-cmd-word">{r.cmd}</p>
                      <p className="lh-sms-cmd-desc">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="lh-sections">
              {doc.sections.map((s, i) => <Section key={i} s={s} />)}
            </div>

            {/* Contact card */}
            <div className="lh-contact-card">
              <p className="lh-contact-label">Contact Information</p>
              <p className="lh-contact-body">
                <strong>Habibi Halal Express, Inc.</strong><br />
                2974 Jerome Ave, Bronx, NY 10468<br />
                Customer Service: <a href="mailto:habibi@habibihe.com">habibi@habibihe.com</a><br />
                Legal &amp; Compliance: <a href="mailto:admin@habibihe.com">admin@habibihe.com</a><br />
                Phone: <a href="tel:7184000443">(718) 400-0443</a>
              </p>
            </div>

            {/* Footer nav */}
            <div className="lh-doc-footer">
              <span>Last updated: {doc.updated}</span>
              <div className="lh-doc-footer-links">
                {DOC_LIST.filter(d => d.id !== activeId).map(d => (
                  <button key={d.id} className="lh-footer-doc-link" onClick={() => switchDoc(d.id)}>
                    {d.icon} {d.label}
                  </button>
                ))}
                <Link to="/contact" className="lh-footer-doc-link">Contact Us</Link>
              </div>
            </div>

          </div>
        </main>

      </div>
    </>
  );
}
