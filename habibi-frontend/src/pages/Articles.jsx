import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { ALL_ARTICLES } from './articlesData';
import './Articles.css';

const ArticleCard = ({ article, large = false }) => {
  const dest = article.externalPath || `/articles/${article.slug}`;
  return (
    <Link to={dest} className={`arc-card${large ? ' arc-card--large' : ''}`}>
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
        <span className="arc-card-read">Read More <ArrowRight size={14} /></span>
      </div>
    </Link>
  );
};

export default function Articles() {
  const featured = ALL_ARTICLES.filter(a => a.featured);
  const rest      = ALL_ARTICLES.filter(a => !a.featured);

  return (
    <div className="articles-page">
      <SEO
        title="Articles | Habibi Halal Express"
        description="Stories, updates, and insights from Habibi Halal Express — the Bronx's premier halal destination."
        keywords="habibi halal express articles, halal food bronx, habibi tacos, halal express stories"
      />

      {/* Hero */}
      <section className="arc-hero">
        <div className="arc-hero-overlay" />
        <div className="container arc-hero-content">
          <p className="arc-eyebrow">HABIBI ARTICLES</p>
          <h1 className="arc-hero-title">Stories from <span className="text-primary">Our Kitchen</span></h1>
          <p className="arc-hero-sub">Menu updates, behind-the-scenes stories, and everything that makes Habibi, Habibi.</p>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="section arc-featured-section">
          <div className="container">
            <p className="arc-section-eyebrow">FEATURED</p>
            <div className="arc-featured-grid">
              {featured.map(a => <ArticleCard key={a.slug || a.title} article={a} large />)}
            </div>
          </div>
        </section>
      )}

      {/* All articles grid */}
      {rest.length > 0 && (
        <section className="section arc-grid-section">
          <div className="container">
            <p className="arc-section-eyebrow">ALL ARTICLES</p>
            <div className="arc-grid">
              {rest.map(a => <ArticleCard key={a.slug || a.title} article={a} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
