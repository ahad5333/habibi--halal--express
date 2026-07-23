import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
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

function readTime(body) {
  const words = (body || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default function ArticleDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [more, setMore]       = useState([]);
  const [status, setStatus]   = useState('loading'); // loading | ok | notfound

  useEffect(() => {
    setStatus('loading');
    setArticle(null);
    articlesAPI.getBySlug(slug)
      .then(a => { setArticle(a); setStatus('ok'); })
      .catch(() => setStatus('notfound'));
    articlesAPI.getAll()
      .then(list => setMore(Array.isArray(list) ? list.filter(a => a.slug !== slug).slice(0, 3) : []))
      .catch(() => {});
    window.scrollTo(0, 0);
  }, [slug]);

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
        description={article.subtitle || article.excerpt || ''}
      />

      <div
        className="article-hero"
        style={mediaSrc(article.media_url) ? { backgroundImage: `url('${mediaSrc(article.media_url)}')` } : undefined}
      >
        <div className="article-hero-overlay" />
        <div className="container article-hero-content">
          <Link to="/articles" className="article-back"><ArrowLeft size={15} /> Back to Articles</Link>
          {article.category && <span className="article-category">{article.category}</span>}
          <h1 className="article-title">{article.title}</h1>
          {article.subtitle && <p className="article-subtitle">{article.subtitle}</p>}
          <div className="article-meta">
            <span><Clock size={13} /> {readTime(article.body)}</span>
            <span>{fmtDate(article.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="container article-body">
        <div dangerouslySetInnerHTML={{ __html: article.body || '' }} />

        <div className="article-cta-block">
          <p>Hungry yet?</p>
          <Link to="/menu" className="article-cta-btn">Order Now</Link>
        </div>
      </div>

      {more.length > 0 && (
        <div className="article-more-section">
          <div className="container">
            <p className="article-more-eyebrow">READ MORE</p>
            <div className="article-more-links">
              {more.map(a => (
                <Link key={a.slug} to={`/articles/${a.slug}`} className="article-more-card">{a.title} →</Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
