import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './LegalPage.css';

const sections = [
  {
    icon: '📲',
    title: '1. Program Description',
    content: `Habibi Halal Express, INC. ("Habibi Halal Express," "we," "us," or "our") operates an SMS messaging program to send you order confirmations, delivery status updates, promotional offers, and other communications related to your use of our services. By opting into our SMS program, you agree to receive recurring automated and non-automated text messages from Habibi Halal Express at the mobile number you provide.`,
  },
  {
    icon: '🔁',
    title: '2. Message Frequency',
    content: `Message frequency will vary based on your account activity and preferences. You may receive transactional messages (order confirmations, delivery updates, account notifications) on an as-needed basis, and promotional messages (special offers, new menu items, loyalty rewards) on a periodic basis. You can expect to receive up to 4 promotional messages per month in addition to transactional messages related to your orders.`,
  },
  {
    icon: '💰',
    title: '3. Message & Data Rates',
    content: `Message and data rates may apply to all SMS messages sent and received under this program. These charges are billed by and payable to your mobile carrier. Habibi Halal Express is not responsible for any charges imposed by your mobile carrier. Please check with your carrier for details on applicable rates.`,
  },
  {
    icon: '🛑',
    title: '4. How to Opt Out (STOP)',
    content: `You may opt out of receiving SMS messages from Habibi Halal Express at any time. To stop receiving messages, reply STOP to any SMS message you receive from us. After opting out, you will receive a single confirmation message and no further messages will be sent to that number, except as required by law. You may re-enroll at any time by texting START or by updating your notification preferences in your account settings at habibihe.com.`,
  },
  {
    icon: '❓',
    title: '5. How to Get Help (HELP)',
    content: `For assistance with the SMS program, reply HELP to any message from us. You may also contact us directly at:\n\n• Email: support@habibihe.com\n• Phone: (718) 555-0100\n• Website: www.habibihe.com/contact\n\nCustomer support is available Monday – Sunday, 10:00 AM – 11:00 PM EST.`,
  },
  {
    icon: '📡',
    title: '6. Supported Carriers',
    content: `Our SMS program is available on most major U.S. carriers, including but not limited to AT&T, Verizon, T-Mobile, Sprint, Boost Mobile, Cricket Wireless, US Cellular, and MetroPCS. Carrier availability may vary. Carriers are not liable for delayed or undelivered messages. Message delivery is not guaranteed and is subject to network availability.`,
  },
  {
    icon: '🔒',
    title: '7. Privacy & Data Use',
    content: `Your mobile number will only be used to deliver SMS messages as described in this program. We will not sell, rent, or share your mobile number with third parties for their marketing purposes without your consent. For more information on how we collect, use, and protect your personal information, please review our Privacy Policy at habibihe.com/privacy-policy.`,
  },
  {
    icon: '⚖️',
    title: '8. Consent Is Not a Condition of Purchase',
    content: `Consent to receive SMS messages is not a condition of purchasing any goods or services from Habibi Halal Express. You may place orders and use our services without enrolling in or maintaining enrollment in our SMS program. Your decision to opt out will not affect your ability to order food or use any other features of our platform.`,
  },
  {
    icon: '📋',
    title: '9. Changes to This Program',
    content: `Habibi Halal Express reserves the right to modify or terminate the SMS messaging program at any time with or without notice. We may also change these SMS Terms and Conditions by posting updated terms at habibihe.com/sms-terms. Your continued participation in the program after changes are posted constitutes your acceptance of the updated terms.`,
  },
  {
    icon: '📍',
    title: '10. Contact Information',
    content: `If you have questions about these SMS Terms and Conditions, please contact us:\n\nHabibi Halal Express, INC.\n555 Fordham Road, Bronx, NY 10458\nEmail: legal@habibihe.com\nPhone: (718) 555-0100\nWebsite: www.habibihe.com/contact`,
  },
];

const SmsTerms = () => (
  <>
    <SEO
      title="SMS Terms & Conditions — Habibi Halal Express"
      description="SMS Terms and Conditions for Habibi Halal Express text message program. Learn about message frequency, opt-out instructions, and data rates."
    />

    {/* Hero */}
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

    {/* Body */}
    <div className="legal-body">
      <div className="legal-container" style={{ padding: '3.5rem 1.5rem' }}>

        <p className="legal-intro">
          By providing your phone number and opting into SMS communications from Habibi Halal Express, you agree to these SMS Terms &amp; Conditions. Please read them carefully. <strong>Consent is not a condition of purchase.</strong> Message and data rates may apply. Reply <strong>STOP</strong> to opt out at any time. Reply <strong>HELP</strong> for assistance.
        </p>

        <div className="legal-sections">
          {sections.map((s) => (
            <div key={s.title} className="legal-section">
              <div className="legal-section-hdr">
                <span className="legal-section-icon">{s.icon}</span>
                <h2 className="legal-section-title">{s.title}</h2>
              </div>
              <p className="legal-section-body" style={{ whiteSpace: 'pre-line' }}>{s.content}</p>
            </div>
          ))}
        </div>

        {/* Quick reference box */}
        <div style={{
          marginTop: '3rem',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1209 100%)',
          border: '1px solid rgba(229,182,78,0.25)',
          borderRadius: 14,
          padding: '2rem',
          color: '#fff',
        }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E5B64E', fontWeight: 700, marginBottom: '1rem' }}>
            Quick Reference
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[
              { cmd: 'STOP', desc: 'Opt out of all messages' },
              { cmd: 'HELP', desc: 'Get support information' },
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
