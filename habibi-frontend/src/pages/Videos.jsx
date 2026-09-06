import React, { useState } from 'react';
import { Film, Eye } from 'lucide-react';
import SEO from '../components/SEO';
import './Videos.css';
import { VIDEOS, VideoCard } from './videoData';

// VIDEOS and VideoCard deliberately live in videoData.jsx, not here. This page
// used to keep its own hardcoded duplicate of both, which is how six placeholder
// entries (all pointing at the same Rick Astley video, under invented titles like
// "Bedford Park Blvd -- Our Flagship Location Tour") survived the 2026-08-05
// cleanup that removed them from videoData.jsx -- they stayed live on this page
// for a month. CustomerStories/KitchenBehindScenes/OurJourney already imported
// from videoData; this page now does too, so there is one list, not two.

const CATEGORIES = ['All', 'Behind the Scenes', 'Customer Stories', 'How We Cook', 'Our Locations'];

const Videos = () => {
  const [activeCategory, setActiveCategory] = useState('All');

  const featured = VIDEOS.filter(v => v.featured);
  const filtered = VIDEOS.filter(v =>
    activeCategory === 'All' ? !v.featured : v.category === activeCategory
  );

  return (
    <div className="videos-page">
      <SEO
        title="Videos | Habibi Halal Express"
        description="Watch Habibi Halal Express cooking videos, behind-the-scenes content, and food stories. Fresh halal food made with love."
        keywords="halal food videos, habibi halal bronx, halal cooking, food stories"
      />

      {/* ── Hero ── */}
      <section className="vid-hero">
        <div className="vid-hero-overlay" />
        <div className="container vid-hero-content">
          <p className="vid-eyebrow">WATCH &amp; EXPLORE</p>
          <h1 className="vid-hero-title">
            Habibi <span className="text-primary">Stories &amp; Videos</span>
          </h1>
          <p className="vid-hero-sub">
            Go behind the counter, meet our team, and see why the Bronx calls Habibi home.
          </p>
          <div className="vid-hero-stats">
            <div className="vid-stat"><Film size={14} /><span>50+ Videos</span></div>
            <div className="vid-stat"><Eye size={14} /><span>200K+ Views</span></div>
          </div>
        </div>
      </section>

      {/* ── Featured ── */}
      <section className="section vid-featured-section">
        <div className="container">
          <div className="section-label">
            <span className="vid-section-eyebrow">FEATURED</span>
            <h2 className="vid-section-title">Staff Picks</h2>
          </div>
          <div className="vid-featured-grid">
            {featured.map((v, i) => (
              <VideoCard key={i} video={v} large />
            ))}
          </div>
        </div>
      </section>

      {/* ── Browse all ── */}
      <section className="section vid-browse-section">
        <div className="container">
          <div className="vid-browse-hdr">
            <div>
              <span className="vid-section-eyebrow">BROWSE</span>
              <h2 className="vid-section-title">All Videos</h2>
            </div>
            {/* Category filter */}
            <div className="vid-cats">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`vid-cat-btn ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="vid-grid">
            {filtered.map((v, i) => (
              <VideoCard key={i} video={v} />
            ))}
            {filtered.length === 0 && (
              <p className="vid-empty">No videos in this category yet. Check back soon.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Subscribe strip ── */}
      <section className="vid-subscribe section border-t border-border">
        <div className="container vid-subscribe-inner">
          <div>
            <h3 className="vid-subscribe-title">Never Miss a Drop</h3>
            <p className="vid-subscribe-sub">New videos every week — subscribe to stay updated.</p>
          </div>
          <a
            href="https://www.youtube.com/@HabibiHalalExpress"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Subscribe on YouTube
          </a>
        </div>
      </section>

    </div>
  );
};

export default Videos;
