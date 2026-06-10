import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Phone, Truck, ChevronRight, CheckCircle } from 'lucide-react';
import { locationsAPI } from '../services/api';
import './DeliveryCoverage.css';

// Neighborhoods covered by our Bronx locations
const COVERED_AREAS = [
  'Mott Haven', 'Hunts Point', 'Longwood', 'Melrose', 'Port Morris',
  'Morrisania', 'Crotona Park East', 'Claremont Village', 'Tremont',
  'Fordham', 'Belmont', 'Morris Heights', 'University Heights',
  'Kingsbridge', 'Riverdale', 'Norwood', 'Woodlawn', 'Wakefield',
  'Co-op City', 'Pelham Bay', 'Castle Hill', 'Soundview', 'Throgs Neck',
  'City Island', 'Eastchester', 'Williamsbridge', 'Baychester',
  'East Tremont', 'West Farms', 'Van Cortlandt Park',
];

export default function DeliveryCoverage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    locationsAPI.getAll()
      .then(d => setLocations(Array.isArray(d) ? d.filter(l => l.is_active) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dc-page">
      {/* Hero */}
      <div className="dc-hero">
        <div className="dc-hero-overlay" />
        <div className="dc-hero-content">
          <p className="dc-eyebrow">DELIVERY COVERAGE</p>
          <h1 className="dc-title">Where Can We Deliver?</h1>
          <p className="dc-sub">Fresh, hot Halal food delivered across the Bronx and surrounding areas. Check if your neighborhood is in range.</p>
          <div className="dc-hero-badges">
            <span className="dc-badge"><Truck size={14} /> Fast Delivery</span>
            <span className="dc-badge"><CheckCircle size={14} /> All 5 Bronx Locations</span>
            <span className="dc-badge"><MapPin size={14} /> 30+ Neighborhoods</span>
          </div>
        </div>
      </div>

      <div className="dc-container">
        {/* Map embed */}
        <section className="dc-map-section">
          <div className="dc-map-hdr">
            <h2 className="dc-section-title">Coverage Map</h2>
            <p className="dc-section-sub">Our 5 Bronx locations cover the entire borough and parts of Westchester & Manhattan.</p>
          </div>
          <div className="dc-map-wrap">
            <iframe
              title="Habibi Delivery Coverage Map"
              width="100%"
              height="420"
              frameBorder="0"
              scrolling="no"
              marginHeight="0"
              marginWidth="0"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-73.9700%2C40.7900%2C-73.7900%2C40.9100&layer=mapnik"
              style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
            />
            <p className="dc-map-credit">
              Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors
            </p>
          </div>
        </section>

        {/* Location cards */}
        <section className="dc-locations-section">
          <h2 className="dc-section-title">Our Delivery Locations</h2>
          <p className="dc-section-sub">Each location has its own delivery radius. Order from the nearest one for the fastest service.</p>

          {loading ? (
            <div className="dc-loading"><div className="dc-spinner" /></div>
          ) : (
            <div className="dc-loc-grid">
              {locations.map((loc, i) => (
                <div key={loc.id} className="dc-loc-card">
                  <div className="dc-loc-num">{i + 1}</div>
                  <div className="dc-loc-body">
                    <h3 className="dc-loc-title">{loc.title}</h3>
                    <p className="dc-loc-addr">{loc.brief_address || loc.exact_address}</p>
                    <div className="dc-loc-meta">
                      {loc.phone_number && (
                        <span className="dc-loc-meta-item"><Phone size={11} /> {loc.phone_number}</span>
                      )}
                      {loc.working_days_hours && (
                        <span className="dc-loc-meta-item"><Clock size={11} /> {loc.working_days_hours}</span>
                      )}
                      <span className="dc-loc-meta-item dc-radius">
                        <MapPin size={11} /> {loc.delivery_radius_miles || 5} mi radius · ${parseFloat(loc.delivery_cost || 0).toFixed(2)} fee
                      </span>
                    </div>
                    <div className={`dc-loc-status ${loc.accepting_orders !== false ? 'open' : 'closed'}`}>
                      <span className="dc-loc-dot" />
                      {loc.accepting_orders !== false ? 'Accepting Orders' : 'Currently Closed'}
                    </div>
                  </div>
                  <Link to={`/checkout?location=${loc.id}`} className="dc-order-btn">
                    Order <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Neighborhoods */}
        <section className="dc-neighborhoods-section">
          <h2 className="dc-section-title">Neighborhoods We Cover</h2>
          <p className="dc-section-sub">Our combined delivery network reaches every neighborhood listed below. Don't see yours? Call us!</p>
          <div className="dc-neighborhood-grid">
            {COVERED_AREAS.map(area => (
              <div key={area} className="dc-neighborhood-chip">
                <CheckCircle size={12} className="dc-chip-icon" /> {area}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="dc-cta">
          <div className="dc-cta-inner">
            <h2 className="dc-cta-title">Ready to Order?</h2>
            <p className="dc-cta-sub">Browse our full menu and place your order in minutes.</p>
            <div className="dc-cta-btns">
              <Link to="/menu" className="btn-dc-primary">View Full Menu</Link>
              <Link to="/checkout" className="btn-dc-secondary">Order Now</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
