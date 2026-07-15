import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Star } from 'lucide-react';
import SEO from '../components/SEO';
import './ArticleDetail.css';

const STATS = [
  { number: '40+', label: 'Protein & topping combinations' },
  { number: '#1', label: 'Most ordered experience' },
  { number: '3', label: 'Locations offering BYO' },
];

export default function ArticleBuildYourOwn() {
  return (
    <div className="article-page">
      <SEO
        title="Build Your Own: The Bronx's Most Customizable Meal | Habibi Halal Express"
        description="How Habibi Halal Express created the Build Your Own feature — the most customizable halal meal in the Bronx."
        keywords="build your own halal bronx, habibi express byo, customizable halal meal"
      />

      <div className="article-hero" style={{ backgroundImage: "url('/images/byo/customize-hero.jpg')" }}>
        <div className="article-hero-overlay" />
        <div className="container article-hero-content">
          <Link to="/articles" className="article-back"><ArrowLeft size={15} /> Back to Articles</Link>
          <span className="article-category">Behind the Menu</span>
          <h1 className="article-title">Build Your Own: The Bronx's Most Customizable Meal</h1>
          <p className="article-subtitle">How We Created a Feature That Changed Everything</p>
          <div className="article-meta">
            <span><Clock size={13} /> 4 min read</span>
            <span>April 2026</span>
          </div>
        </div>
      </div>

      <div className="container article-body">

        <p className="article-lead">
          We didn't plan for Build Your Own to become our most popular feature. We built it to solve a
          problem — and it turned out that problem was something thousands of Bronx residents felt every
          time they ordered halal food.
        </p>

        <h2>The Problem We Kept Hearing</h2>
        <p>
          "Can I get the lamb but with the chicken sauce?" "Can I have half rice, half salad?" "Is there
          any way I can get two proteins?" We heard versions of these questions dozens of times every day.
          Our menu was good, but it wasn't flexible enough for how our customers actually wanted to eat.
        </p>
        <p>
          The Bronx is one of the most diverse communities in the world. Different dietary needs, different
          tastes, different family sizes ordering at once. A fixed menu was always going to leave someone
          wanting more.
        </p>

        <div className="article-stats-row">
          {STATS.map((s, i) => (
            <div key={i} className="article-stat">
              <span className="article-stat-number">{s.number}</span>
              <span className="article-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <h2>How We Built It</h2>
        <p>
          The Build Your Own system took months to get right. The challenge wasn't technical — it was
          operational. How do you let someone mix and match proteins, bases, toppings, and sauces without
          slowing down a kitchen that serves hundreds of people a day?
        </p>
        <p>
          The answer was structure. We defined clear tiers: choose your base, choose your proteins, choose
          your toppings, choose your sauce. Simple steps, endless combinations. The kitchen knows exactly
          what to prepare without reading a paragraph of special instructions.
        </p>

        <h2>What You Can Build</h2>
        <p>
          Today, a Build Your Own meal can include any combination of our halal proteins — lamb kofta,
          chicken shawarma, beef gyro, grilled chicken, mixed grill — over your choice of rice, salad, or
          a wrap. Add toppings, pick your sauces, and you're done.
        </p>
        <p>
          The most popular combination? Lamb kofta + chicken shawarma over rice, with white sauce and
          hot sauce on the side. We call it the Bronx Special — unofficially.
        </p>

        <h2>Why It Changed Things</h2>
        <p>
          When Build Your Own launched, our average order value went up. But more importantly, our customer
          satisfaction went up. People felt like they were eating what they actually wanted, not a
          compromise. That's what we were going for.
        </p>

        <div className="article-cta-block">
          <p>Ready to build your own?</p>
          <Link to="/customize" className="article-cta-btn">Start Building <Star size={15} /></Link>
        </div>

      </div>

      <div className="article-more-section">
        <div className="container">
          <p className="article-more-eyebrow">READ MORE</p>
          <div className="article-more-links">
            <Link to="/articles/lamb-kofta-secret" className="article-more-card">The Secret Behind Our Kofta →</Link>
            <Link to="/articles/halal-certified" className="article-more-card">Our Halal Certification →</Link>
            <Link to="/our-journey" className="article-more-card">Our Journey →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
