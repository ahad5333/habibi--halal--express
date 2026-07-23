import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { articlesAPI } from '../services/api';
import './Articles.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function mediaSrc(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return `${API_BASE}${url}`;
  return url;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function readTime(excerpt) {
  const words = (excerpt || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return words ? `${Math.max(1, Math.round(words / 40))} min read` : null; // excerpt is short, rough estimate
}

// Curated links to existing site pages that aren't CMS "articles" but belong
// in this hub — these aren't admin-editable here since each is a real,
// separately-maintained page rather than blog content.
const EXTERNAL_LINKS = [
  {
    slug: null,
    externalPath: '/kitchen-behind-the-scenes',
    title: 'Kitchen Behind the Scenes',
    subtitle: 'Go Inside Our Kitchen and See How We Cook',
    category: 'Behind the Scenes',
    dateLabel: 'Ongoing',
    readTimeLabel: 'Video + Story',
    image: '/images/food/kitchen-hero.png',
    excerpt: `Real food. Real people. No shortcuts. Come inside our kitchen and see exactly how we craft every dish — from the first cut to the final plate.`,
  },
  {
    slug: null,
    externalPath: '/customer-stories',
    title: 'Customer Stories',
    subtitle: 'Real Voices From the Bronx Community',
    category: 'Community',
    dateLabel: 'Ongoing',
    readTimeLabel: 'Stories',
    image: '/images/food/stories-hero.png',
    excerpt: `Hear from the real people who make Habibi Halal Express what it is. Thousands of orders, one community, and stories that keep us going every single day.`,
  },
  {
    slug: null,
    externalPath: '/our-journey',
    title: 'Our Journey: From One Window to Three Locations',
    subtitle: 'The Story of Habibi Halal Express',
    category: 'Our Story',
    dateLabel: 'Est. 2018',
    readTimeLabel: '7 min read',
    image: '/images/food/journey-hero.png',
    excerpt: `From a single window in Bedford Park to three locations across the Bronx — this is how Habibi Halal Express came to be, and where we're headed next.`,
  },
];

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
          {article.readTimeLabel && <span><Clock size={12} /> {article.readTimeLabel}</span>}
          <span>{article.dateLabel}</span>
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
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    articlesAPI.getAll()
      .then(list => setArticles(Array.isArray(list) ? list : []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  const mapped = articles.map(a => ({
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle,
    category: a.category,
    dateLabel: fmtDate(a.created_at),
    readTimeLabel: readTime(a.excerpt),
    image: mediaSrc(a.media_url) || '/images/art-of-the-feast.webp',
    excerpt: a.excerpt,
  }));

  const featured = mapped.slice(0, 1);
  const rest      = [...mapped.slice(1), ...EXTERNAL_LINKS];

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

      {!loading && (
        <>
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
        </>
      )}
    </div>
  );
}
