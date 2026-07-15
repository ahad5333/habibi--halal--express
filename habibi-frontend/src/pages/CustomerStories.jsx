import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Star, Quote } from 'lucide-react';
import SEO from '../components/SEO';
import { VIDEOS, VideoCard } from './videoData';
import './Videos.css';
import './SubVideoPage.css';

const videos = VIDEOS.filter(v => v.category === 'Customer Stories');

const TESTIMONIALS = [
  {
    name: 'Amara S.',
    location: 'Bedford Park, Bronx',
    stars: 5,
    text: 'I\'ve been coming here since they first opened. The lamb kofta is unlike anything else in the Bronx — it tastes like home. My whole family orders from Habibi at least twice a week.',
  },
  {
    name: 'Marcus T.',
    location: 'Fordham, Bronx',
    stars: 5,
    text: 'First time I tried the mixed grill platter I couldn\'t believe the portion size. And it\'s all halal, properly certified. This place has become my go-to after Jumu\'ah every Friday.',
  },
  {
    name: 'Fatima R.',
    location: 'Grand Concourse, Bronx',
    stars: 5,
    text: 'The customer service is what keeps me coming back. They always remember my order and the food is consistently good. You don\'t find that kind of consistency at most places.',
  },
  {
    name: 'David P.',
    location: 'Mott Haven, Bronx',
    stars: 5,
    text: 'I\'m not even Muslim but I eat halal because the quality is just better. Habibi is the best halal spot I\'ve found in New York, period. The chicken over rice is perfect every time.',
  },
  {
    name: 'Yusra K.',
    location: 'Kingsbridge, Bronx',
    stars: 5,
    text: 'We ordered from Habibi for our daughter\'s graduation dinner. They handled 40 people without a single issue — food was hot, portions were generous, and everyone loved it.',
  },
  {
    name: 'Jerome A.',
    location: 'Tremont, Bronx',
    stars: 5,
    text: 'The Build Your Own option is genius. I mix the lamb with the rice and extra white sauce — it\'s become my weekly treat. Consistent quality, fair prices, and they\'re always friendly.',
  },
];

const STATS = [
  { number: '6+', label: 'Years Serving the Bronx' },
  { number: '50K+', label: 'Orders Delivered' },
  { number: '4.9★', label: 'Average Rating' },
  { number: '3', label: 'Bronx Locations' },
];

export default function CustomerStories() {
  return (
    <div className="videos-page svp-page">
      <SEO
        title="Customer Stories | Habibi Halal Express"
        description="Real voices from the Bronx community. Hear what our customers say about Habibi Halal Express — the food, the experience, and the people."
        keywords="habibi halal customer reviews, bronx food community, halal food stories"
      />

      {/* Hero */}
      <section className="svp-hero svp-hero--stories">
        <div className="svp-hero-overlay" />
        <div className="svp-hero-content">
          <span className="svp-eyebrow"><Heart size={13} /> COMMUNITY VOICES</span>
          <h1 className="svp-hero-title">Customer <span className="svp-accent">Stories</span></h1>
          <p className="svp-hero-sub">
            The best review we can get is yours. Hear from the real people who make
            Habibi Halal Express what it is — our Bronx community.
          </p>
          <div className="svp-hero-tags">
            <span className="svp-tag"><Heart size={12} /> Community</span>
            <span className="svp-tag">Real Reviews</span>
            <span className="svp-tag">The Bronx Speaks</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="svp-section svp-section--alt">
        <div className="container">
          <div className="svp-stats-row">
            {STATS.map((s, i) => (
              <div key={i} className="svp-stat">
                <span className="svp-stat-number">{s.number}</span>
                <span className="svp-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section svp-section">
        <div className="container">
          <p className="svp-section-eyebrow">WHAT PEOPLE SAY</p>
          <h2 className="svp-section-title">Real Words From Real Customers</h2>
          <div className="svp-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="svp-testimonial-card">
                <Quote size={20} className="svp-quote-icon" />
                <p className="svp-testimonial-text">"{t.text}"</p>
                <div className="svp-testimonial-footer">
                  <div className="svp-testimonial-stars">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} size={13} fill="#f59e0b" color="#f59e0b" />
                    ))}
                  </div>
                  <div>
                    <p className="svp-testimonial-name">{t.name}</p>
                    <p className="svp-testimonial-location">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Videos */}
      {videos.length > 0 && (
        <section className="section svp-section svp-section--alt">
          <div className="container">
            <p className="svp-section-eyebrow">VIDEO STORIES</p>
            <h2 className="svp-section-title">Hear It In Their Own Words</h2>
            <div className="vid-grid">
              {videos.map((v, i) => <VideoCard key={i} video={v} large={i === 0} />)}
            </div>
          </div>
        </section>
      )}

      {/* Review CTA */}
      <section className="svp-section">
        <div className="container svp-review-block">
          <div className="svp-review-text">
            <h3>Want to share your story?</h3>
            <p>Your experience matters — leave a review and join thousands of happy Habibi customers.</p>
          </div>
          <div className="svp-review-btns">
            <Link to="/reviews/new" className="svp-cta-btn">Leave a Review <ArrowRight size={15} /></Link>
            <Link to="/videos" className="svp-cta-btn svp-cta-btn--outline">All Videos</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
