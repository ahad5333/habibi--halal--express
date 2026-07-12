import React, { useState, useEffect } from 'react';
import { Tag, Copy, Check, Clock, ShoppingBag, Percent, DollarSign, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './Offers.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function typeIcon(type) {
  if (type === 'percentage')    return <Percent size={18} />;
  if (type === 'free_delivery') return <Truck size={18} />;
  return <DollarSign size={18} />;
}

function typeColor(type) {
  if (type === 'percentage')    return 'offers-chip--gold';
  if (type === 'free_delivery') return 'offers-chip--blue';
  return 'offers-chip--green';
}

function CopyBtn({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="offers-copy-btn" onClick={copy} title="Copy code">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied!' : 'Copy Code'}
    </button>
  );
}

export default function Offers() {
  const [offers, setOffers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch(`${BASE}/api/offers`)
      .then(r => r.json())
      .then(data => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load offers. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="offers-page">
      <SEO
        title="Deals & Special Offers | Habibi Halal Express"
        description="Check out the latest deals, discounts and coupon codes at Habibi Halal Express. Save on your next halal food order."
        keywords="habibi halal deals, coupon code, halal food discount bronx"
      />

      {/* Hero */}
      <section className="offers-hero">
        <div className="offers-hero-overlay" />
        <div className="offers-hero-content">
          <span className="offers-hero-eyebrow">EXCLUSIVE DEALS</span>
          <h1 className="offers-hero-title">Special <span className="offers-hero-accent">Offers</span></h1>
          <p className="offers-hero-sub">Active coupon codes — copy and paste at checkout to save.</p>
        </div>
      </section>

      <section className="offers-section">
        <div className="offers-container">

          {loading && (
            <div className="offers-loading">
              <div className="offers-spinner" />
              <p>Loading offers…</p>
            </div>
          )}

          {error && (
            <div className="offers-error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && offers.length === 0 && (
            <div className="offers-empty">
              <Tag size={48} className="offers-empty-icon" />
              <h3>No Active Offers Right Now</h3>
              <p>Check back soon — we're always cooking up something special!</p>
              <Link to="/menu" className="btn btn-primary">Browse Menu</Link>
            </div>
          )}

          {!loading && offers.length > 0 && (
            <>
              <div className="offers-grid">
                {offers.map((offer, i) => (
                  <div key={offer.code || i} className="offers-card">
                    <div className={`offers-chip ${typeColor(offer.discount_type)}`}>
                      {typeIcon(offer.discount_type)}
                      <span>{offer.value_display}</span>
                    </div>

                    <h3 className="offers-card-title">{offer.title}</h3>
                    <p className="offers-card-desc">{offer.description}</p>

                    {offer.min_order > 0 && (
                      <p className="offers-card-min">
                        Min. order: <strong>${parseFloat(offer.min_order).toFixed(2)}</strong>
                      </p>
                    )}

                    <div className="offers-code-row">
                      <span className="offers-code">{offer.code}</span>
                      <CopyBtn code={offer.code} />
                    </div>

                    {offer.expires_at && (
                      <p className="offers-expires">
                        <Clock size={12} />
                        Expires {new Date(offer.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}

                    <Link to="/checkout" className="offers-order-btn">
                      <ShoppingBag size={15} /> Order Now
                    </Link>
                  </div>
                ))}
              </div>

              <div className="offers-note">
                <Tag size={14} />
                <span>Codes are applied at checkout. One code per order. Cannot be combined with other offers.</span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
