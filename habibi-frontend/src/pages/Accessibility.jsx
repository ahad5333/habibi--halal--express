import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    icon: '🎯',
    title: '1. Our Commitment',
    content: `Habibi Halal Express, INC. is committed to ensuring digital accessibility for people with disabilities. We continually work to improve the user experience for everyone and apply relevant accessibility standards. We believe that every person deserves equal access to our services, regardless of ability, technology, or circumstance.`,
  },
  {
    icon: '📐',
    title: '2. Conformance Status',
    content: `We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. These guidelines explain how to make web content more accessible to people with disabilities. Conformance with these guidelines helps make our website more usable to all users. Our current status is: Partially Conformant — some parts of the content do not fully conform to the accessibility standard, and we are actively working to address these areas.`,
  },
  {
    icon: '♿',
    title: '3. Accessibility Features',
    content: null,
    list: [
      'Keyboard navigation: All interactive elements (buttons, links, forms, modals) are fully accessible via keyboard without requiring a mouse.',
      'Screen reader support: Our pages use semantic HTML5 elements, ARIA labels, and descriptive alt text on all meaningful images.',
      'Color contrast: Text and interactive elements meet or exceed WCAG 2.1 AA minimum contrast ratios of 4.5:1 for normal text and 3:1 for large text.',
      'Resizable text: All text on our website can be resized up to 200% without loss of content or functionality.',
      'Focus indicators: Visible focus states are applied to all interactive elements to assist keyboard and assistive technology users.',
      'Skip navigation: A "Skip to main content" link is available on all pages for users who rely on keyboard navigation.',
      'Form labels: All form fields include visible and programmatic labels. Required fields are clearly indicated.',
      'Error identification: Form validation errors are clearly described in text and associated with the relevant input field.',
      'Responsive design: Our website adapts to different screen sizes and orientations, including mobile devices and tablets.',
      'No seizure triggers: We do not use content that flashes more than three times per second.',
    ],
  },
  {
    icon: '📱',
    title: '4. Mobile Accessibility',
    content: `Our website and mobile applications are designed with mobile accessibility in mind. We support system-level accessibility features including:\n\n• iOS VoiceOver and Android TalkBack screen readers\n• Dynamic Type / Font Size settings\n• Reduced Motion preferences\n• High Contrast mode\n• Touch target sizes that meet minimum 44×44pt guidelines`,
  },
  {
    icon: '🔧',
    title: '5. Known Limitations',
    content: null,
    list: [
      'Third-party payment processors (Stripe, PayPal): Some embedded payment forms are provided by third-party vendors and may not fully conform to our accessibility standards. We are working with our vendors to improve accessibility in these areas.',
      'Embedded maps: Location map integrations may have limited screen reader support. Text alternatives are provided for all location information.',
      'Legacy images: Some older promotional images may lack descriptive alt text. We are actively reviewing and updating these.',
      'Video captions: Videos currently do not include captions or transcripts. We are in the process of adding these.',
    ],
  },
  {
    icon: '🛠️',
    title: '6. Technologies Relied Upon',
    content: `Our website relies on the following technologies for conformance with accessibility standards:\n\n• HTML5\n• CSS3\n• JavaScript (React 19)\n• ARIA (Accessible Rich Internet Applications)\n• SVG for icons (Lucide React)\n\nThe following technologies are used to evaluate conformance: NVDA, VoiceOver, JAWS, axe DevTools, Lighthouse, and Wave.`,
  },
  {
    icon: '📣',
    title: '7. Feedback & Contact',
    content: `We welcome your feedback on the accessibility of our website. If you experience any accessibility barriers or have suggestions for improvement, please contact us using any of the following methods:\n\n• Email: accessibility@habibihe.com\n• Phone: (718) 555-0100 (TTY users may dial 711)\n• Mailing address: Habibi Halal Express, INC., 555 Fordham Road, Bronx, NY 10458\n• Contact form: habibihe.com/contact\n\nWe aim to respond to accessibility feedback within 2 business days.`,
  },
  {
    icon: '⚖️',
    title: '8. Formal Complaints',
    content: `If you are not satisfied with our response to your accessibility concern, you may contact the following bodies:\n\n• U.S. Department of Justice (ADA Information Line): 1-800-514-0301\n• New York State Division of Human Rights: 1-888-392-3644\n\nWe are committed to resolving accessibility issues promptly and working with users to find reasonable accommodations.`,
  },
  {
    icon: '🗓️',
    title: '9. Assessment Approach',
    content: `Habibi Halal Express assesses the accessibility of our website using the following approaches:\n\n• Self-evaluation by our development team against WCAG 2.1 AA criteria\n• Automated testing using Lighthouse and axe DevTools during each development build\n• Manual testing with keyboard-only navigation and screen readers (VoiceOver on iOS and macOS)\n• Periodic third-party accessibility audits\n\nThis statement was last reviewed and updated on June 1, 2026.`,
  },
];

const Accessibility = () => (
  <>
    <SEO
      title="Accessibility Statement — Habibi Halal Express"
      description="Habibi Halal Express is committed to digital accessibility for all users. Learn about our accessibility features, known limitations, and how to contact us for assistance."
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

    {/* Body */}
    <div className="legal-body">
      <div className="legal-container" style={{ padding: '3.5rem 1.5rem' }}>

        <p className="legal-intro">
          Habibi Halal Express is dedicated to providing a website and mobile application that is accessible to the widest possible audience. If you encounter any accessibility barriers or have questions about our accessibility features, please <Link to="/contact" style={{ color: '#E5B64E' }}>contact us</Link> — we are here to help.
        </p>

        <div className="legal-sections">
          {sections.map((s) => (
            <div key={s.title} className="legal-section">
              <div className="legal-section-hdr">
                <span className="legal-section-icon">{s.icon}</span>
                <h2 className="legal-section-title">{s.title}</h2>
              </div>
              {s.content && (
                <p className="legal-section-body" style={{ whiteSpace: 'pre-line' }}>{s.content}</p>
              )}
              {s.list && (
                <ul className="legal-list">
                  {s.list.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Conformance badge area */}
        <div style={{
          marginTop: '3rem',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1f0d 100%)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 14,
          padding: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: '2.5rem' }}>♿</div>
          <div>
            <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              WCAG 2.1 Level AA — Partially Conformant
            </p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              We are actively working to achieve full AA conformance. If you need immediate assistance with any feature, please call us at (718) 555-0100.
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
