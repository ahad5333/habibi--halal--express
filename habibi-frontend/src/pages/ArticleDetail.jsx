import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, ChefHat, ArrowRight, Share2, Check } from 'lucide-react';
import SEO from '../components/SEO';
import { articlesAPI } from '../services/api';
import './ArticleDetail.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function mediaSrc(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return `${API_BASE}${url}`;
  return url; // frontend-local static asset, e.g. /images/...
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Excerpts/body come from the admin's rich-text editor and can contain real
// HTML (<p> tags, etc.) — strip it for anywhere it's shown as plain text.
function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readTime(body) {
  const words = stripHtml(body).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default function ArticleDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [more, setMore]       = useState([]);
  const [status, setStatus]   = useState('loading'); // loading | ok | notfound
  const [shared, setShared]   = useState(false);
  const [progress, setProgress] = useState(0);
  const bodyRef = useRef(null);

  useEffect(() => {
    setStatus('loading');
    setArticle(null);
    setShared(false);
    articlesAPI.getBySlug(slug)
      .then(a => { setArticle(a); setStatus('ok'); })
      .catch(() => setStatus('notfound'));
    articlesAPI.getAll()
      .then(list => setMore(Array.isArray(list) ? list.filter(a => a.slug !== slug).slice(0, 3) : []))
      .catch(() => {});
    window.scrollTo(0, 0);
  }, [slug]);

  /* Reading progress — % scrolled through the article body specifically */
  useEffect(() => {
    if (status !== 'ok') return;
    const onScroll = () => {
      const el = bodyRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.5;
      const seen = Math.min(Math.max(-rect.top, 0), total);
      setProgress(total > 0 ? Math.round((seen / total) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [status]);

  const share = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: article?.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    }
  };

  if (status === 'loading') {
    return <div className="article-page" style={{ minHeight: '60vh' }} />;
  }

  if (status === 'notfound') {
    return (
      <div className="article-page" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <SEO title="Article Not Found" noindex />
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>This article couldn't be found.</p>
        <Link to="/articles" className="article-cta-btn">Back to All Articles</Link>
      </div>
    );
  }

  return (
    <div className="article-page">
      <SEO
        title={`${article.title} | Habibi Halal Express`}
        description={article.subtitle || stripHtml(article.excerpt) || ''}
      />

      <div className="article-progress-track" aria-hidden="true">
        <div className="article-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="article-hero-header">
        <div className="container article-hero-content">
          <div className="article-hero-top">
            <Link to="/articles" className="article-back"><ArrowLeft size={15} /> Back to Articles</Link>
            <button className="article-share-btn" onClick={share} aria-label="Share this article">
              {shared ? <><Check size={13} /> Copied</> : <><Share2 size={13} /> Share</>}
            </button>
          </div>
          {article.category && <span className="article-category">{article.category}</span>}
          <h1 className="article-title">{article.title}</h1>
          {article.subtitle && <p className="article-subtitle">{article.subtitle}</p>}
        </div>
      </div>

      {mediaSrc(article.media_url) && (
        <div className="container article-poster-wrap">
          <img src={mediaSrc(article.media_url)} alt={article.title} className="article-poster-img" />
        </div>
      )}

      <div className="container article-body-wrap">
        <div className="article-byline">
          <img src="/images/logos/logo.webp" alt="" className="article-byline-avatar" />
          <div className="article-byline-info">
            <span className="article-byline-name">Habibi Halal Express Team</span>
            <div className="article-meta">
              <span>{fmtDate(article.created_at)}</span>
              <span className="article-meta-dot">·</span>
              <span><Clock size={12} /> {readTime(article.body)}</span>
            </div>
          </div>
        </div>

        <div className="article-body" ref={bodyRef}>
          <div dangerouslySetInnerHTML={{ __html: article.body || '' }} />

          <div className="article-cta-block">
            <div className="article-cta-glow" aria-hidden="true" />
            <ChefHat size={26} className="article-cta-icon" />
            <p className="article-cta-eyebrow">Ready when you are</p>
            <h3 className="article-cta-heading">Taste the Habibi Difference</h3>
            <p className="article-cta-sub">Fresh halal food, made to order, ready at any of our Bronx locations.</p>
            <div className="article-cta-btns">
              <Link to="/menu" className="article-cta-btn">Order Now <ArrowRight size={15} /></Link>
              <Link to="/locations" className="article-cta-btn article-cta-btn--outline">Find a Location</Link>
            </div>
          </div>
        </div>
      </div>

      {more.length > 0 && (
        <div className="article-more-section">
          <div className="container">
            <p className="article-more-eyebrow">KEEP READING</p>
            <div className="article-more-grid">
              {more.map(a => (
                <Link key={a.slug} to={`/articles/${a.slug}`} className="article-more-card">
                  <div className="article-more-card-img">
                    <img src={mediaSrc(a.media_url) || '/images/art-of-the-feast.webp'} alt="" loading="lazy" />
                    {a.category && <span className="article-more-card-cat">{a.category}</span>}
                  </div>
                  <div className="article-more-card-body">
                    <h4>{a.title}</h4>
                    <span className="article-more-card-read">Read More <ArrowRight size={13} /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
