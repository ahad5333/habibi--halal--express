import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Share2, Mail } from 'lucide-react';
import { contactAPI } from '../services/api';
import './Footer.css';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState(''); // '' | 'loading' | 'ok' | 'error'

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubStatus('loading');
    try {
      await contactAPI.subscribe(email);
      setSubStatus('ok');
      setEmail('');
    } catch {
      setSubStatus('error');
    }
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <img src="/images/logos/logo-full.jpg" alt="Habibi Halal Express" className="footer-logo-img" />
          </Link>
          <p className="footer-tagline">
            Authentic Halal Dining. Every dish crafted with tradition, precision, and passion — 365 days a year.
          </p>
          <div className="social-icons mt-4">
            <a href="https://facebook.com/habibihalalexpress" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook" className="social-fb">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="https://instagram.com/habibihalalexpress" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram" className="social-ig">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
            <a href="https://tiktok.com/@habibihalalexpress" target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok" className="social-tt">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
              </svg>
            </a>
            <a href="https://youtube.com/habibihalalexpress" target="_blank" rel="noopener noreferrer" aria-label="YouTube" title="YouTube" className="social-yt">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
          </div>
          {/* QR codes — scan to follow on social media */}
          <div className="footer-qr-row">
            {[
              { label: 'Facebook',  src: '/images/qr/qr-facebook.svg',  href: 'https://facebook.com/habibihalalexpress' },
              { label: 'Instagram', src: '/images/qr/qr-instagram.svg', href: 'https://instagram.com/habibihalalexpress' },
              { label: 'TikTok',    src: '/images/qr/qr-tiktok.svg',    href: 'https://tiktok.com/@habibihalalexpress' },
              { label: 'YouTube',   src: '/images/qr/qr-youtube.svg',   href: 'https://youtube.com/habibihalalexpress' },
            ].map(({ label, src, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="footer-qr-item" title={`Scan to follow on ${label}`}>
                <img
                  src={src}
                  alt={`QR code for ${label}`}
                  className="footer-qr-img"
                />
                <span className="footer-qr-label">{label}</span>
              </a>
            ))}
          </div>

        </div>

        <div className="footer-links">
          <div className="footer-column">
            <h4>Discover</h4>
            <Link to="/menu">Our Menu</Link>
            <Link to="/locations">Locations</Link>
            <Link to="/delivery-coverage">Delivery Coverage</Link>
            <Link to="/checkout">Order Online</Link>
            <Link to="/wholesale">Wholesale</Link>
          </div>
          <div className="footer-column">
            <h4>Company</h4>
            <Link to="/about">Our Story</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/contact?type=media">Press Kit</Link>
          </div>
          <div className="footer-column">
            <h4>Legal &amp; Support</h4>
            <Link to="/contact">Contact Us</Link>
            <Link to="/health-safety">Health &amp; Safety</Link>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/sms-terms">SMS Terms</Link>
            <Link to="/accessibility">Accessibility</Link>
          </div>
          <div className="footer-newsletter">
            <h4>Newsletter</h4>
            <p>Join our inner circle for exclusive tastings.</p>
            {subStatus === 'ok' ? (
              <p className="newsletter-success">✓ You're on the list!</p>
            ) : (
              <form className="newsletter-form" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn-subscribe" disabled={subStatus === 'loading'}>
                  {subStatus === 'loading' ? '...' : '➔'}
                </button>
              </form>
            )}
            {subStatus === 'error' && (
              <p className="newsletter-error">Failed to subscribe. Try again.</p>
            )}
          </div>
        </div>
      </div>
      {/* Trust & Certification Badges */}
      <div className="footer-trust-row">
        <div className="footer-trust-badges">
          <div className="footer-badge-card">
            <img src="/images/hero/halal-certified.png" alt="Halal Certified" className="footer-badge-card-img footer-badge-card-img--circle" />
            <span className="footer-badge-card-label">Halal<br/>Certified</span>
          </div>
          <div className="footer-badge-card">
            <img src="/images/logos/grade-a.jpg" alt="NYC Grade A" className="footer-badge-card-img footer-badge-card-img--rect" />
            <span className="footer-badge-card-label">NYC Health<br/>Grade A</span>
          </div>
          <div className="footer-badge-card">
            <img src="/images/logos/delivery-service.png" alt="Delivery Service" className="footer-badge-card-img footer-badge-card-img--circle" />
            <span className="footer-badge-card-label">Fast<br/>Delivery</span>
          </div>
          <div className="footer-badge-card">
            <img src="/images/logos/pickup-sign.png" alt="Online Order Pick Up" className="footer-badge-card-img footer-badge-card-img--circle footer-badge-card-img--dark" />
            <span className="footer-badge-card-label">Online<br/>Pick Up</span>
          </div>
          <a
            href="https://maps.google.com/?q=Habibi+Halal+Express+Bronx"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-badge-card footer-badge-card--google"
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="footer-badge-google-icon">
              <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 5.92 1 1 5.92 1 12.2s4.92 11.2 11.24 11.2c6.6 0 11-4.64 11-11.2 0-.753-.08-1.325-.2-1.915H12.24z"/>
            </svg>
            <span className="footer-badge-card-label">Order<br/>on Google</span>
          </a>
          <div className="footer-badge-card footer-badge-card--ssl">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="footer-badge-ssl-icon">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="footer-badge-card-label">SSL<br/>Secured</span>
          </div>
          <div className="footer-badge-card footer-badge-card--authnet">
            <img src="/images/partners/authorize-net.png" alt="Authorize.Net" className="footer-badge-partner-img" />
            <span className="footer-badge-card-label">Secure<br/>Payments</span>
          </div>
          <div className="footer-badge-card footer-badge-card--paypal">
            <img src="/images/partners/paypal.png" alt="PayPal" className="footer-badge-partner-img" />
            <span className="footer-badge-card-label">Pay<br/>with PayPal</span>
          </div>
        </div>
        <div className="footer-delivery-badges">
          <span className="footer-delivery-label">Order via:</span>
          <img src="/images/partners/ubereats.png" alt="UberEats" className="delivery-partner-logo" title="UberEats" onError={e => { e.target.style.display='none'; }} />
          <img src="/images/partners/doordash.png" alt="DoorDash" className="delivery-partner-logo" title="DoorDash" onError={e => { e.target.style.display='none'; }} />
          <img src="/images/partners/grubhub.png" alt="GrubHub" className="delivery-partner-logo" title="GrubHub" onError={e => { e.target.style.display='none'; }} />
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-urgent-contact">
          Get Urgent Reply: <a href="mailto:admin@habibiHE.com">admin@habibiHE.com</a>
        </p>
        <p>© {new Date().getFullYear()} Habibi Halal Express, INC. All rights reserved.</p>
        <div className="footer-payments">
          <span className="payment-label">We Accept:</span>
          <img src="/images/partners/visa.png" alt="Visa" className="payment-logo" title="Visa" />
          <img src="/images/partners/apple-pay.png" alt="Apple Pay" className="payment-logo" title="Apple Pay" />
          <img src="/images/partners/google-pay.png" alt="Google Pay" className="payment-logo" title="Google Pay" />
          <img src="/images/partners/paypal.png" alt="PayPal" className="payment-logo" title="PayPal" />
          <span className="payment-badge">Mastercard</span>
          <span className="payment-badge">Amex</span>
          <span className="payment-badge">Cash App</span>
          <span className="payment-badge">Zelle</span>
          <span className="payment-badge">Cash</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
