import React from 'react';
import { Link } from 'react-router-dom';
import { SprayCan, Leaf, UtensilsCrossed, ConciergeBell } from 'lucide-react';
import SEO from '../components/SEO';
import './About.css';

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About Habibi Halal Express",
  "description": "Learn about the heritage, culinary craftsmanship, and local community sourcing that powers Habibi Halal Express.",
  "publisher": {
    "@type": "Organization",
    "name": "Habibi Halal Express",
    "logo": {
      "@type": "ImageObject",
      "url": "https://habibihalalexpress.com/images/logos/logo.png"
    }
  }
};

const WHY_US = [
  {
    type: 'bg',
    bgImg: '/images/food/kitchen.jpg',
    icon: <SprayCan size={20} />,
    title: 'Uncompromising Hygiene',
    desc: 'Our sanctuary of flavor maintains the highest standards of cleanliness. Sanitized workstations, meticulously groomed professionals — your safety is our silent promise.',
  },
  {
    type: 'img-top',
    topImg: '/images/food/food-1.png',
    icon: <Leaf size={20} />,
    title: 'Daily Fresh Sourcing',
    desc: "We don't believe in leftovers. Our ingredients arrive with the morning sun, sourced from local artisans who share our passion for peak season perfection.",
  },
  {
    type: 'img-bottom',
    bottomImg: '/images/food/shesh-kebab.jpg',
    icon: <UtensilsCrossed size={20} />,
    title: 'Artisanal Taste',
    desc: 'Chef-curated menus that balance generational recipes with modern gastronomic techniques. Every spice is measured, every sear is intentional.',
  },
  {
    type: 'bg',
    bgImg: '/images/food/food-ref-13.jpg',
    icon: <ConciergeBell size={20} />,
    title: 'Professional Hospitality',
    desc: 'Service is an art form. Our team is trained not just to serve, but to anticipate your needs with the quiet grace of a five-star concierge.',
  },
];

const STAFF_ROLES = [
  { label: 'Management', img: '/images/staff/management.png' },
  { label: 'Kitchen', img: '/images/staff/kitchen.png' },
  { label: 'Serving', img: '/images/staff/serving.png' },
  { label: 'Delivery', img: '/images/staff/delivery.png' },
];

const SOCIAL = [
  { label: 'Facebook', url: '#' },
  { label: 'Instagram', url: '#' },
  { label: 'YouTube', url: '#' },
  { label: 'TikTok', url: '#' },
];

const getSocialIcon = (label) => {
  switch (label.toLowerCase()) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" className="social-btn-svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" className="social-btn-svg">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" className="social-btn-svg">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" className="social-btn-svg">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.19 1.1 1.25 2.61 2.02 4.23 2.16v3.91c-1.39-.08-2.74-.63-3.83-1.52-.6-.49-1.1-1.09-1.49-1.78v7.23c0 4.14-3.36 7.5-7.5 7.5-3.32 0-6.19-2.15-7.14-5.21-.86-2.73.01-5.74 2.19-7.55 1.72-1.42 4.02-2.02 6.22-1.62V12.2c-1.28-.43-2.72-.08-3.66.86-.96.96-1.2 2.47-.59 3.65.6 1.17 1.88 1.88 3.2 1.74 1.44-.15 2.5-1.4 2.47-2.85V.02z"/>
        </svg>
      );
    default:
      return null;
  }
};

const COLLAGE = [
  '/images/food/food-3.png',
  '/images/food/food-4.png',
  '/images/food/food-5.png',
  '/images/food/food-6.png',
];

const STATS = [
  { num: '2002', label: 'Est.' },
  { num: '5', label: 'Locations' },
  { num: '10K+', label: 'Happy Customers' },
  { num: '365', label: 'Days a Year' },
];

function FeatureCard({ feature: f }) {
  if (f.type === 'bg') return (
    <div className="feature-card feature-card-bg" style={{ backgroundImage: `url(${f.bgImg})` }}>
      <div className="f-overlay">
        <div className="f-icon">{f.icon}</div>
        <h3 className="f-title">{f.title}</h3>
        <p className="f-desc">{f.desc}</p>
      </div>
    </div>
  );

  if (f.type === 'img-top') return (
    <div className="feature-card feature-card-split">
      <img src={f.topImg} alt={f.title} className="f-split-img" />
      <div className="f-split-body">
        <div className="f-icon">{f.icon}</div>
        <h3 className="f-title">{f.title}</h3>
        <p className="f-desc">{f.desc}</p>
      </div>
    </div>
  );

  return (
    <div className="feature-card feature-card-split feature-card-flip">
      <div className="f-split-body">
        <div className="f-icon">{f.icon}</div>
        <h3 className="f-title">{f.title}</h3>
        <p className="f-desc">{f.desc}</p>
      </div>
      <img src={f.bottomImg} alt={f.title} className="f-split-img" />
    </div>
  );
}

const About = () => (
  <div className="about-page page-watermark">
    <SEO
      title="About Our Story | Culinary Heritage & Sourcing"
      description="Learn about Habibi Halal Express' heritage, our uncompromising standards of hygiene, daily fresh local sourcing, and our artisanal Halal culinary craftsmanship."
      keywords="halal restaurant history, clean food certification, fresh gyro sourcing, habibi halal story"
      schema={aboutSchema}
    />

    {/* ── Hero ── */}
    <section className="about-hero">
      <div className="about-hero-ribbon" />
      <div className="about-hero-content">
        <img src="/images/logos/halal.png" alt="Halal Certified" className="about-hero-halal" />
        <h1 className="about-hero-title">
          Crafting the Gold Standard<br />of <span style={{ color: '#E5B64E' }}>Halal Dining</span>
        </h1>
        <p className="about-hero-sub">
          Where traditional heritage meets contemporary culinary artistry. We redefine
          the Halal experience through meticulous sourcing and artisanal execution.
        </p>
        <div className="about-stats">
          {STATS.map(s => (
            <div key={s.label} className="about-stat">
              <span className="about-stat-num">{s.num}</span>
              <span className="about-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Why Choose Us ── */}
    <section className="about-section">
      <div className="container">
        <div className="section-label-center">
          <p className="about-eyebrow">THE HABIBI DIFFERENCE</p>
          <h2 className="about-section-title">Why Choose Us?</h2>
          <p className="about-section-sub">Four pillars that elevate every meal we serve.</p>
        </div>
        <div className="features-grid">
          {WHY_US.map((f, i) => <FeatureCard key={i} feature={f} />)}
        </div>
      </div>
    </section>

    {/* ── Our Story ── */}
    <section className="about-section about-section-alt border-t border-border">
      <div className="container about-story-layout">
        <div className="about-story-text">
          <p className="about-eyebrow">OUR STORY</p>
          <h2 className="about-section-title">
            Born in the Bronx,<br /><span className="text-primary">Raised on Tradition</span>
          </h2>
          <p className="about-body-text">
            Habibi Halal Express began as a dream — to serve the Bronx community with food that honors
            both culture and craft. Since 2002, our founders have been guided by one principle: never
            compromise on quality, tradition, or hospitality.
          </p>
          <p className="about-body-text">
            Every dish on our menu carries the weight of generational wisdom. From our 24-hour marinated
            proteins to our house-blended spice mixes, the soul of the Middle East lives in every bite.
            We are not just a restaurant — we are a cultural anchor for communities across the five boroughs.
          </p>
          <Link to="/menu" className="btn btn-primary about-cta-inline">Explore Our Menu ➔</Link>
        </div>
        <div className="about-story-img-wrap">
          <img
            src="/images/our_story_kitchen.jpg"
            alt="Our Kitchen"
            className="about-story-img"
            onError={e => { e.target.src = '/images/food/food-8.png'; }}
          />
          <div className="about-story-badge">
            <img src="/images/logos/halal.png" alt="Halal Certified" className="story-badge-halal" />
            <div>
              <p className="story-badge-line1" style={{ color: '#ffffff' }}>Zabiha Halal</p>
              <p className="story-badge-line2" style={{ color: '#ffffff' }}>Certified</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ── Team ── */}
    <section className="about-section border-t border-border">
      <div className="container">
        <div className="section-label-center">
          <p className="about-eyebrow">THE PEOPLE BEHIND THE FLAVORS</p>
          <h2 className="about-section-title">Our Team</h2>
        </div>
        <div className="staff-grid">
          {STAFF_ROLES.map(r => (
            <div key={r.label} className="staff-card">
              <div className="staff-img-wrap">
                <img src={r.img} alt={r.label} className="staff-img" />
              </div>
              <p className="staff-label">{r.label}</p>
            </div>
          ))}
        </div>
        <div className="hiring-banner">
          <img src="/images/staff/hiring.png" alt="We're Hiring" className="hiring-img" />
          <div className="hiring-text">
            <h3 className="hiring-title">We're Hiring! <span className="text-primary">🌟</span></h3>
            <p className="hiring-sub">Join the Habibi family. We're always looking for passionate people who love great food and great service.</p>
          </div>
          <Link to="/careers" className="btn btn-outline hiring-btn">See Open Roles</Link>
        </div>
      </div>
    </section>

    {/* ── Community ── */}
    <section className="about-section about-section-alt border-t border-border">
      <div className="container about-community-layout">
        <div className="about-community-text">
          <p className="about-eyebrow">STAY CONNECTED</p>
          <h2 className="about-section-title">
            Join Our<br /><span className="text-primary">Community</span>
          </h2>
          <p className="about-body-text">
            Follow our journey behind the kitchen doors. Experience the art of Halal through our lens
            and stay updated on exclusive tastings, events, and new menu drops.
          </p>
          <div className="social-grid">
            {SOCIAL.map(s => (
              <a
                key={s.label}
                href={s.url}
                className={`social-btn social-${s.label.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {getSocialIcon(s.label)}
                <span>{s.label}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="collage-grid">
          {COLLAGE.map((src, i) => (
            <div key={i} className="collage-item">
              <img src={src} alt="" className="collage-img" />
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA ── */}
    <section className="about-cta">
      <div className="about-cta-overlay" />
      <div className="about-cta-content">
        <img src="/images/logos/logo.png" alt="Habibi Halal Express" className="about-cta-logo" />
        <h2 className="about-cta-title">Ready to taste the excellence?</h2>
        <p className="about-cta-sub">Order online or visit one of our 5 Bronx locations today.</p>
        <div className="about-cta-btns">
          <Link to="/menu" className="btn btn-primary">Order Now ➔</Link>
          <Link to="/locations" className="btn btn-outline">Our Locations</Link>
        </div>
      </div>
    </section>

  </div>
);

export default About;
