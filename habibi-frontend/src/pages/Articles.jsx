import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import './Articles.css';

const ARTICLES = [
  {
    slug: 'habibi-tacos',
    title: 'Introducing Habibi Tacos',
    subtitle: 'A Bold New Twist on a Classic Favorite',
    category: 'New on the Menu',
    date: 'June 2026',
    readTime: '4 min read',
    image: '/images/articles/habibi-taco-hero.jpg',
    excerpt: `At Habibi Halal Express, we believe that great food starts with great ingredients. That's exactly what inspired us to create Habibi Tacos, our signature take on one of the world's most loved street foods.`,
    featured: true,
  },
];

const ArticleCard = ({ article, large = false }) => (
  <Link to={`/articles/${article.slug}`} className={`arc-card${large ? ' arc-card--large' : ''}`}>
    <div className="arc-card-img">
      <img src={article.image} alt={article.title} loading="lazy" />
      <span className="arc-card-category">{article.category}</span>
    </div>
    <div className="arc-card-body">
      <div className="arc-card-meta">
        <span><Clock size={12} /> {article.readTime}</span>
        <span>{article.date}</span>
      </div>
      <h2 className="arc-card-title">{article.title}</h2>
      {article.subtitle && <p className="arc-card-subtitle">{article.subtitle}</p>}
      <p className="arc-card-excerpt">{article.excerpt}</p>
      <span className="arc-card-read">Read Article <ArrowRight size={14} /></span>
    </div>
  </Link>
);

export default function Articles() {
  const featured = ARTICLES.filter(a => a.featured);
  const rest      = ARTICLES.filter(a => !a.featured);

  return (
    <div className="articles-page">
      <SEO
        title="Articles | Habibi Halal Express"
        description="Stories, updates, and insights from Habibi Halal Express — the Bronx's premier halal destination."
        keywords="habibi halal express articles, halal food bronx, habibi tacos, halal express stories"
      />

      {/* ── Hero ── */}
      <section className="arc-hero">
        <div className="arc-hero-overlay" />
        <div className="container arc-hero-content">
          <p className="arc-eyebrow">HABIBI ARTICLES</p>
          <h1 className="arc-hero-title">Stories from <span className="text-primary">Our Kitchen</span></h1>
          <p className="arc-hero-sub">Menu updates, behind-the-scenes stories, and everything that makes Habibi, Habibi.</p>
        </div>
      </section>

      {/* ── Featured ── */}
      {featured.length > 0 && (
        <section className="section arc-featured-section">
          <div className="container">
            <p className="arc-section-eyebrow">FEATURED</p>
            <div className="arc-featured-grid">
              {featured.map(a => <ArticleCard key={a.slug} article={a} large />)}
            </div>
          </div>
        </section>
      )}

      {/* ── More articles ── */}
      {rest.length > 0 && (
        <section className="section arc-grid-section">
          <div className="container">
            <p className="arc-section-eyebrow">MORE ARTICLES</p>
            <div className="arc-grid">
              {rest.map(a => <ArticleCard key={a.slug} article={a} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {ARTICLES.length === 0 && (
        <div className="container arc-empty">
          <p>More articles coming soon. Check back often!</p>
        </div>
      )}

    </div>
  );
}
