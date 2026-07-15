import React from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, Flame, ArrowRight, CheckCircle, Clock, Leaf, Shield } from 'lucide-react';
import SEO from '../components/SEO';
import { VIDEOS, VideoCard } from './videoData';
import './Videos.css';
import './SubVideoPage.css';

const videos = VIDEOS.filter(v => v.category === 'Behind the Scenes' || v.category === 'How We Cook');
const featured = videos.filter(v => v.featured);
const rest     = videos.filter(v => !v.featured);

const PROCESS_STEPS = [
  {
    icon: <Clock size={22} />,
    title: 'Fresh Every Morning',
    desc: 'Our kitchen opens before sunrise. Marinades are prepared overnight, and every protein is seasoned fresh by 6am so the flavors have time to develop before the first order hits.',
  },
  {
    icon: <Flame size={22} />,
    title: 'Live Fire Grilling',
    desc: 'We grill over real flame — no shortcuts. Our charcoal setup gives every kebab, kofta, and chicken piece that authentic smoky char you can taste from the first bite.',
  },
  {
    icon: <Leaf size={22} />,
    title: 'Hand-Cut, Always Fresh',
    desc: 'No frozen shortcuts. Vegetables are hand-cut daily, rice is cooked in batches throughout service, and sauces are made from scratch every single day.',
  },
  {
    icon: <Shield size={22} />,
    title: 'Certified Halal — Always',
    desc: 'Every supplier we use is halal-certified and vetted. We maintain full traceability on all our proteins so you can order with complete confidence.',
  },
];

const STANDARDS = [
  'Halal-certified proteins from vetted suppliers',
  'No MSG, no artificial preservatives',
  'Rice cooked fresh in small batches throughout the day',
  'Sauces and marinades made from scratch daily',
  'Full kitchen deep-clean every night after close',
  'Open kitchen — we have nothing to hide',
];

export default function KitchenBehindScenes() {
  return (
    <div className="videos-page svp-page">
      <SEO
        title="Kitchen Behind the Scenes | Habibi Halal Express"
        description="Go behind the counter at Habibi Halal Express. Watch how our team cooks, preps, and serves authentic halal food every day in the Bronx."
        keywords="habibi halal kitchen, behind the scenes, halal cooking bronx, food prep"
      />

      {/* Hero */}
      <section className="svp-hero svp-hero--kitchen">
        <div className="svp-hero-overlay" />
        <div className="svp-hero-content">
          <span className="svp-eyebrow"><ChefHat size={13} /> BEHIND THE COUNTER</span>
          <h1 className="svp-hero-title">Kitchen Behind <span className="svp-accent">the Scenes</span></h1>
          <p className="svp-hero-sub">
            Real food. Real people. No shortcuts. Come inside our kitchen and see exactly how
            we craft every dish — from the first cut to the final plate.
          </p>
          <div className="svp-hero-tags">
            <span className="svp-tag"><Flame size={12} /> Live Fire Grilling</span>
            <span className="svp-tag">Fresh Daily</span>
            <span className="svp-tag">Halal Certified</span>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="section svp-section">
        <div className="container">
          <div className="svp-intro-block">
            <div className="svp-intro-text">
              <p className="svp-section-eyebrow">OUR PHILOSOPHY</p>
              <h2 className="svp-section-title">We Cook Like It's for Our Own Family</h2>
              <p className="svp-body-text">
                At Habibi Halal Express, the kitchen isn't a production line — it's where everything
                we stand for comes to life. Every morning our team arrives early to prep, season,
                and set up so that by the time your order comes in, the food is at its best.
              </p>
              <p className="svp-body-text">
                We don't believe in reheated food or pre-portioned packs. If it's not fresh,
                it doesn't go on your plate. That's a standard we've held since day one
                and it's never going to change.
              </p>
            </div>
            <div className="svp-standards-box">
              <p className="svp-standards-title">Our Kitchen Standards</p>
              <ul className="svp-standards-list">
                {STANDARDS.map((s, i) => (
                  <li key={i}><CheckCircle size={14} className="svp-check" /> {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Process steps */}
      <section className="section svp-section svp-section--alt">
        <div className="container">
          <p className="svp-section-eyebrow">HOW WE DO IT</p>
          <h2 className="svp-section-title">From Prep to Plate</h2>
          <div className="svp-process-grid">
            {PROCESS_STEPS.map((step, i) => (
              <div key={i} className="svp-process-card">
                <div className="svp-process-icon">{step.icon}</div>
                <h4 className="svp-process-title">{step.title}</h4>
                <p className="svp-process-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured videos */}
      {featured.length > 0 && (
        <section className="section svp-section">
          <div className="container">
            <p className="svp-section-eyebrow">WATCH</p>
            <h2 className="svp-section-title">See It For Yourself</h2>
            <div className="vid-featured-grid">
              {featured.map((v, i) => <VideoCard key={i} video={v} large />)}
            </div>
          </div>
        </section>
      )}

      {/* Rest of videos */}
      {rest.length > 0 && (
        <section className="section svp-section svp-section--alt">
          <div className="container">
            <p className="svp-section-eyebrow">MORE FROM THE KITCHEN</p>
            <h2 className="svp-section-title">More Videos</h2>
            <div className="vid-grid">
              {rest.map((v, i) => <VideoCard key={i} video={v} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="svp-cta-strip">
        <p className="svp-cta-text">Taste the difference that care makes.</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/menu" className="svp-cta-btn">Order Now <ArrowRight size={15} /></Link>
          <Link to="/videos" className="svp-cta-btn svp-cta-btn--outline">All Videos</Link>
        </div>
      </section>
    </div>
  );
}
