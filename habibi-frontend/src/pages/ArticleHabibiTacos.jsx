import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Share2 } from 'lucide-react';
import SEO from '../components/SEO';
import './ArticleHabibiTacos.css';

const ARTICLE = {
  title: 'Introducing Habibi Tacos',
  subtitle: 'A Bold New Twist on a Classic Favorite',
  date: 'June 2026',
  readTime: '4 min read',
  hero: '/images/articles/habibi-taco-hero.jpg',
  body: [
    {
      type: 'lead',
      text: `At Habibi Halal Express, we believe that great food starts with great ingredients and an uncompromising commitment to quality. That's exactly what inspired us to create Habibi Tacos, our signature take on one of the world's most loved street foods.`,
    },
    {
      type: 'para',
      text: `We didn't simply add tacos to our menu. We spent countless hours selecting ingredients, testing combinations, and refining every detail to create a taco experience worthy of the Habibi name.`,
    },
    {
      type: 'heading',
      text: 'Premium Halal Proteins, Every Time',
    },
    {
      type: 'para',
      text: `Every Habibi Taco begins with premium halal proteins, carefully seasoned and grilled to bring out their natural flavor and tenderness. Whether you choose our juicy grilled chicken, tender steak, flavorful lamb gyro, shrimp, or another favorite, every bite is prepared fresh to order using quality ingredients you can taste.`,
    },
    {
      type: 'heading',
      text: 'The Foundation: Our Signature Tortilla',
    },
    {
      type: 'para',
      text: `The foundation of every great taco is the tortilla. That's why we chose a soft, premium flour tortilla specifically selected for its texture, flexibility, and ability to complement our signature fillings while holding everything together perfectly from the first bite to the last.`,
    },
    {
      type: 'quote',
      text: `Freshness is equally important. Crisp lettuce, ripe tomatoes, fresh onions, and premium toppings are prepared daily to provide the perfect balance of flavor, texture, and color.`,
    },
    {
      type: 'heading',
      text: 'Built Your Way',
    },
    {
      type: 'para',
      text: `What truly makes Habibi Tacos unique is that they're built your way. Add your favorite vegetables, choose your protein, select your sauces, and customize every detail to create a taco that's uniquely yours. Whether you prefer something simple and classic or fully loaded with bold flavors, the choice is always yours.`,
    },
    {
      type: 'heading',
      text: 'Our Signature Sauces',
    },
    {
      type: 'para',
      text: `Our signature sauces, from our famous white sauce to our spicy hot sauce and other flavorful options, bring every ingredient together to create a satisfying combination of fresh, smoky, creamy, and vibrant flavors.`,
    },
    {
      type: 'para',
      text: `Habibi Tacos aren't about copying tradition, they're about celebrating it while adding our own signature style. By combining premium halal ingredients, fresh vegetables, carefully selected tortillas, and complete customization, we've created a taco experience that is bold, exciting, and unmistakably Habibi.`,
    },
    {
      type: 'closing',
      text: `If you're looking for something fresh, flavorful, and different, we invite you to discover why Habibi Tacos are quickly becoming one of our most exciting menu creations.`,
    },
  ],
};

export default function ArticleHabibiTacos() {
  const share = () => {
    if (navigator.share) {
      navigator.share({ title: ARTICLE.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="art-page">
      <SEO
        title="Introducing Habibi Tacos | Habibi Halal Express"
        description="Discover Habibi Tacos — premium halal proteins, fresh vegetables, signature sauces, and complete customization on a soft flour tortilla. Bold, fresh, and built your way."
        keywords="habibi tacos, halal tacos, bronx tacos, habibi halal express, halal street food"
      />

      {/* ── Hero ── */}
      <div className="art-hero">
        <img src={ARTICLE.hero} alt="Habibi Taco" className="art-hero-img" />
        <div className="art-hero-overlay" aria-hidden="true" />
        <div className="art-hero-vignette" aria-hidden="true" />

        <Link to="/articles" className="art-back">
          <ArrowLeft size={14} /> All Articles
        </Link>
        <button className="art-share-btn art-share-btn--corner" onClick={share} aria-label="Share">
          <Share2 size={14} /> Share
        </button>

        <div className="art-hero-content">
          <p className="art-hero-brand">✦ Habibi Halal Express ✦</p>

          <div className="art-hero-rule-row">
            <span className="art-hero-rule-line" />
            <span className="art-hero-badge">New on the Menu</span>
            <span className="art-hero-rule-line" />
          </div>

          <h1 className="art-hero-title">
            <em className="art-hero-introducing">Introducing</em>
            <span className="art-hero-name">Habibi Tacos</span>
          </h1>

          <p className="art-hero-subtitle">{ARTICLE.subtitle}</p>

          <div className="art-hero-meta">
            <span><Clock size={13} /> {ARTICLE.readTime}</span>
            <span className="art-meta-sep">·</span>
            <span>{ARTICLE.date}</span>
          </div>
        </div>

        <div className="art-hero-bottom-bar">
          <span>Fresh</span>
          <span className="art-hero-dot">◆</span>
          <span>Premium Halal</span>
          <span className="art-hero-dot">◆</span>
          <span>Built Your Way</span>
        </div>
      </div>

      {/* ── Article body ── */}
      <div className="art-body-wrap">
        <article className="art-body">

          {ARTICLE.body.map((block, i) => {
            if (block.type === 'lead')    return <p key={i} className="art-lead">{block.text}</p>;
            if (block.type === 'para')    return <p key={i} className="art-para">{block.text}</p>;
            if (block.type === 'heading') return <h2 key={i} className="art-heading">{block.text}</h2>;
            if (block.type === 'closing') return <p key={i} className="art-closing">{block.text}</p>;
            if (block.type === 'quote')   return (
              <blockquote key={i} className="art-quote">
                <span className="art-quote-mark">"</span>
                {block.text}
              </blockquote>
            );
            return null;
          })}

          {/* ── Closing stamp ── */}
          <div className="art-stamp-section">
            <div className="art-stamp-line" />
            <div className="art-stamp">
              <p className="art-stamp-text">Fresh Ingredients. Premium Halal. Built Your Way.</p>
            </div>
            <div className="art-stamp-line" />
          </div>

          {/* ── CTA ── */}
          <div className="art-cta-box">
            <p className="art-cta-eyebrow">Ready to try it?</p>
            <h3 className="art-cta-title">Experience the Habibi Taco Difference</h3>
            <p className="art-cta-sub">Order online or visit us at any of our Bronx locations.</p>
            <div className="art-cta-btns">
              <Link to="/menu" className="btn btn-primary art-cta-btn">Order Now</Link>
              <Link to="/locations" className="btn btn-outline art-cta-btn">Find a Location</Link>
            </div>
          </div>

          {/* ── Tags ── */}
          <div className="art-tags">
            {['Tacos', 'New Menu Items', 'Halal', 'Fresh Ingredients', 'Bronx'].map(t => (
              <span key={t} className="art-tag">{t}</span>
            ))}
          </div>

          {/* ── Back link ── */}
          <Link to="/articles" className="art-back-footer">
            <ArrowLeft size={15} /> Back to All Articles
          </Link>

        </article>
      </div>
    </div>
  );
}
