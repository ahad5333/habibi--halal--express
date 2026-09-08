import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronRight, ChevronLeft, Sparkles, Shield, Eye, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { menuAPI } from '../services/api';
import './Home.css';

const featFallbackImg = (id, idx = 0) => `/images/menu/${((id ?? idx) % 70) + 1}.jpg`;
const toWebp = url => url && /\.(jpe?g|png)$/i.test(url) ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const FEAST_VIDEOS = [
  `${API_URL}/videos/habibi-video-1.mp4`,
  `${API_URL}/videos/habibi-video-2.mp4`,
  `${API_URL}/videos/habibi-video-3.mp4`,
];


const EDITORIAL_REVIEWS = [
  {
    stars: 5,
    text: "The best beef bowls in New York. Hands down. The mint teas are a plus. A staple in my weekly. A true authentic experience.",
    logo: "/images/reviews/logo_1.png",
    name: "NY Foodie Mag",
    type: "Editorial Review"
  },
  {
    stars: 5,
    text: "Incredible service and even better food. The atmosphere is sophisticated and welcoming... come here at least once a week!",
    logo: "/images/reviews/logo_2.png",
    name: "Local Eats Guide",
    type: "Featured Spot"
  },
  {
    stars: 5,
    text: "Finally a halal place that serves as much style and attention to details. An absolute sensory experience.",
    logo: "/images/reviews/logo_3.png",
    name: "Culinary Times",
    type: "Critics Choice"
  },
  {
    stars: 5,
    text: "Quick delivery, perfectly packaged, and the flavors remain as vibrant as dining in. Top tier service!",
    logo: "/images/reviews/logo_4.png",
    name: "Express App",
    type: "Top Rated"
  },
  {
    stars: 5,
    text: "A masterclass in modern Mediterranean cuisine. The fresh ingredients and bold spices make every dish unforgettable.",
    logo: "/images/reviews/logo_5.png",
    name: "The Daily Courier",
    type: "Weekly Feature"
  },
  {
    stars: 5,
    text: "Obsessed with their personalized bowls! You can literally taste the quality and love put into the prep.",
    logo: "/images/reviews/logo_6.png",
    name: "Chef's Blog",
    type: "Food Critic"
  }
];

const restaurantSchema = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Habibi Halal Express",
  "image": "https://habibihalalexpress.com/images/logos/logo.png",
  "@id": "https://habibihalalexpress.com",
  "url": "https://habibihalalexpress.com",
  "telephone": "+1-718-400-0443",
  "priceRange": "$$",
  "menu": "https://habibihalalexpress.com/menu",
  "servesCuisine": ["Halal", "Mediterranean", "Middle Eastern", "Platters", "Gyros", "Bergers"],
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Bedford Park Blvd & Jerome Ave",
    "addressLocality": "Bronx",
    "addressRegion": "NY",
    "postalCode": "10458",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 40.873426,
    "longitude": -73.890060
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "11:00",
      "closes": "23:00"
    }
  ],
  "sameAs": [
    "https://facebook.com/habibihalalexpress",
    "https://instagram.com/habibihalalexpress",
    "https://youtube.com/habibihalalexpress"
  ]
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Auto-plays when scrolled into view on mobile; hover-to-play on desktop
const FeastVideo = ({ src }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else { video.pause(); video.currentTime = 0; }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      className="feast-thumb-video"
      muted
      loop
      playsInline
      preload="metadata"
      onMouseEnter={e => e.currentTarget.play().catch(() => {})}
      onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
    />
  );
};

const STATS = [
  { value: 500,  suffix: '+',  labelKey: 'home.stats.menuItems',      icon: '🍽️' },
  { value: 10,   suffix: 'K+', labelKey: 'home.stats.happyCustomers', icon: '❤️' },
  { value: 3,    suffix: '',   labelKey: 'home.stats.bronxLocations', icon: '📍' },
  { value: 100,  suffix: '%',  labelKey: 'home.stats.halalCertified', icon: '✅' },
];

function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

function StatCard({ icon, value, suffix, labelKey, animate }) {
  const { t } = useTranslation();
  const count = useCountUp(value, 1600, animate);
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div className="stat-value">
        {count}{suffix}
      </div>
      <div className="stat-label">{t(labelKey)}</div>
    </div>
  );
}

function StatsRow() {
  const ref = useRef(null);
  const [fired, setFired] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setFired(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div className="stats-row" ref={ref}>
      <div className="stats-row-inner">
        {STATS.map((s, i) => (
          <StatCard key={i} {...s} animate={fired} />
        ))}
      </div>
    </div>
  );
}

const Home = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [liveReviews, setLiveReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [featItems, setFeatItems] = useState([]);
  const carouselRef = useRef(null);

  const [typedText, setTypedText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const words = t('home.typedWords', { returnObjects: true });
    const typingSpeed = 100;
    const deletingSpeed = 50;
    const delayBetweenWords = 2000;
    
    let timer;
    const currentWord = words[wordIndex];
    
    if (isDeleting) {
      timer = setTimeout(() => {
        setTypedText(currentWord.substring(0, typedText.length - 1));
      }, deletingSpeed);
    } else {
      timer = setTimeout(() => {
        setTypedText(currentWord.substring(0, typedText.length + 1));
      }, typingSpeed);
    }

    if (!isDeleting && typedText === currentWord) {
      timer = setTimeout(() => setIsDeleting(true), delayBetweenWords);
    } else if (isDeleting && typedText === '') {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
    }

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, wordIndex]);

  useEffect(() => {
    fetch(`${API_BASE}/api/reviews?featured=true&sort=rating&limit=6`)
      .then(r => r.json())
      .then(data => {
        if (data.reviews) setLiveReviews(data.reviews);
        if (data.stats)   setReviewStats(data.stats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    menuAPI.getAll()
      .then(data => {
        const items = Array.isArray(data) ? data : (data.menus || data.items || []);
        if (items.length > 0) setFeatItems(items.slice(0, 14));
      })
      .catch(() => {});
  }, []);

  const scrollCarousel = (dir) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };


  return (
    <div className="home-page">
      <SEO
        title="Home | Authentic Halal Dining & Fast Delivery"
        description="Order fresh, healthy halal platters, gyros, bergers, and sides from Habibi Halal Express. Serving the Bronx, NY, with fast delivery and premium ingredients."
        keywords="halal food bronx, mediterranean restaurant nyc, halal delivery near me, gyro wrap, chicken over rice platter"
        schema={restaurantSchema}
      />
      {/* ═══════════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════
          HERO SECTION (Image Matched)
      ═══════════════════════════════════════════════════════ */}
      <section className="hero-section">
        <div className="hero-top-dark">
          
          <div className="floating-ingredients">
          </div>

          {/* ── Giant logo watermark behind hero content ── */}
          <div className="hero-logo-watermark" aria-hidden="true">
            <img src="/images/logos/logo-badge.png" alt="" />
          </div>

          <div className="container hero-content">
            <h1 className="hero-title-exact">
              <span className="hero-title-line-1">{t('home.hero.titleLine1')}</span><br />
              <span className="hero-title-line-2">{t('home.hero.titleLine2')}</span><br />
              <span className="hero-title-line-3"><span className="animated-hero-words">{typedText}<span className="typewriter-cursor">|</span></span></span>
            </h1>

            <p className="hero-creative-line">
              {t('home.hero.tagline')}
            </p>

            <div className="hero-cta-group">
              <Link to="/menu" className="hero-btn-primary">{t('common.orderNow')}</Link>
              <Link to="/menu" className="hero-btn-ghost">{t('home.hero.viewMenu')}</Link>
            </div>

          </div>

        </div>

        <div className="hero-bottom-light">
          <div className="container text-center">
            <h2 className="hero-bottom-title-exact">
              {t('home.hero.bottomTitle')}
            </h2>

            <div className="hero-food-wrapper">
              <img src="/images/hero/round_food.webp" alt="Delicious Food" className="hero-food-img" />
            </div>

            <p className="hero-bottom-desc-exact">
              {t('home.hero.bottomDesc')}
            </p>

            <div className="hero-divider-exact">
               <div className="hero-divider-line"></div>
            </div>

            <div className="hero-arched-cards">
              {[
                { src: '/images/mixed-platter.jpg',      alt: 'Bowl 1' },
                { src: '/images/art-of-the-feast.jpg',   alt: 'Bowl 2' },
                { src: '/images/personalized-bowls.jpg', alt: 'Bowl 3' },
              ].map(({ src, alt }) => (
                <div key={alt} className="arched-card">
                  <div className="arched-card-inner">
                    <img src={src} alt={alt} />
                  </div>
                  <svg
                    className="arched-card-border"
                    viewBox="0 0 220 280"
                    preserveAspectRatio="none"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M 0,280 L 0,110 A 110,110 0 0,1 220,110 L 220,280" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════
          STATS COUNTER ROW
      ═══════════════════════════════════════════════════════ */}
      <StatsRow />

      {/* ═══════════════════════════════════════════════════════
          BUILD YOUR OWN — CTA STRIP (Redesigned)
      ═══════════════════════════════════════════════════════ */}
      <section className="byo-strip">
        <div className="byo-strip-bg-overlay" aria-hidden="true" />
        <div className="byo-strip-glow" aria-hidden="true" />
        <div className="container byo-strip-inner">
          {/* Left — content */}
          <div className="byo-strip-left">
            <div className="byo-strip-eyebrow">
              <span className="byo-strip-eyebrow-dot" />
              {t('home.byo.eyebrow')}
            </div>
            <h3 className="byo-strip-title">
              {t('home.byo.titleLine1')}<br />
              <span className="byo-strip-title-accent">{t('home.byo.titleLine2')}</span>
            </h3>
            <p className="byo-strip-desc">
              {t('home.byo.descPrefix')} <strong>{t('home.byo.descStrong')}</strong>.
            </p>
            {/* Step indicators */}
            <div className="byo-steps">
              {['base', 'cheese', 'veggies', 'protein', 'sauces', 'extras', 'drink'].map((step, i) => (
                <div key={step} className="byo-step">
                  <div className="byo-step-num">{i + 1}</div>
                  <span className="byo-step-label">{t(`home.byo.steps.${step}`)}</span>
                </div>
              ))}
            </div>
            <Link to="/customize" className="byo-strip-btn">
              <span>{t('home.byo.customizeNow')}</span>
              <span className="byo-strip-btn-arrow"><ChevronRight size={18} /></span>
            </Link>
          </div>

          {/* Right — floating bowl image with creative orbital decorations */}
          <div className="byo-strip-right">
            <div className="byo-bowl-glow" aria-hidden="true" />

            {/* Counter-rotating dashed outer ring */}
            <div className="byo-orbit-ring" aria-hidden="true" />

            {/* Orbiting glow dots */}
            <div className="byo-orbiter byo-orbiter-1" aria-hidden="true" />
            <div className="byo-orbiter byo-orbiter-2" aria-hidden="true" />
            <div className="byo-orbiter byo-orbiter-3" aria-hidden="true" />

            {/* Floating ingredient chips — left side */}
            <div className="byo-chip byo-chip-1" aria-hidden="true">{t('home.byo.chips.freshBase')}</div>
            <div className="byo-chip byo-chip-2" aria-hidden="true">{t('home.byo.chips.halalProtein')}</div>

            {/* Floating ingredient chips — right side */}
            <div className="byo-chip byo-chip-3" aria-hidden="true">{t('home.byo.chips.boldFlavour')}</div>
            <div className="byo-chip byo-chip-4" aria-hidden="true">{t('home.byo.chips.combos')}</div>

            {/* Sparkle glints */}
            <span className="byo-glint byo-glint-1" aria-hidden="true">✦</span>
            <span className="byo-glint byo-glint-2" aria-hidden="true">✦</span>
            <span className="byo-glint byo-glint-3" aria-hidden="true">✦</span>
            <span className="byo-glint byo-glint-4" aria-hidden="true">✦</span>

            <div className="byo-bowl-crop">
              <img src="/images/byo-bowl-3d.webp" alt="Build Your Own Bowl" className="byo-strip-icon" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          OUR STORY / CULINARY HERITAGE
      ═══════════════════════════════════════════════════════ */}
      <section className="section story-section">
        <div className="container story-container">
          <div className="story-content-col">
            <p className="section-eyebrow text-gold">{t('home.story.eyebrow')}</p>
            <h2 className="heading-2 story-title">{t('home.story.title')}</h2>
            <p className="story-lead mt-3">
              {t('home.story.lead')}
            </p>
            <p className="story-text mt-3">
              {t('home.story.text')}
            </p>
            <div className="story-highlights mt-4">
              <div className="story-highlight-item">
                <span className="story-highlight-number">100%</span>
                <span className="story-highlight-label">{t('home.story.zabihaCertified')}</span>
              </div>
              <div className="story-highlight-item">
                <span className="story-highlight-number">Fresh</span>
                <span className="story-highlight-label">{t('home.story.neverFrozen')}</span>
              </div>
              <div className="story-highlight-item">
                <span className="story-highlight-number">Bronx</span>
                <span className="story-highlight-label">{t('home.story.localHeritage')}</span>
              </div>
            </div>
          </div>
          <div className="story-image-col">
            <div className="story-image-frame">
              <img src="/images/story-chef.webp" alt="Fresh authentic halal culinary preparation" className="story-main-img" loading="lazy" />
              <div className="story-image-overlay-card">
                <span className="overlay-card-title">{t('home.story.est')}</span>
                <span className="overlay-card-desc">{t('home.story.handcrafted')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          THE ART OF THE FEAST
      ═══════════════════════════════════════════════════════ */}
      <section className="section feast-section text-center">
        <div className="container">
          <p className="section-eyebrow text-gold">{t('home.feast.eyebrow')}</p>
          <h2 className="heading-2">{t('home.feast.title')}</h2>

          <div className="feast-thumbs mt-5">
            {FEAST_VIDEOS.map((src, i) => (
              <div key={i} className="feast-thumb">
                <FeastVideo src={src} />
              </div>
            ))}
          </div>

          <p className="feast-desc mt-4">
            {t('home.feast.desc')}
          </p>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════
          CURATED SELECTIONS
      ═══════════════════════════════════════════════════════ */}
      <section className="section curated-section">
        <div className="container">
          <div className="section-header space-between">
            <div>
              <h2 className="heading-2">{t('home.curated.title')}</h2>
              <p className="section-desc mt-2">
                {t('home.curated.desc')}
              </p>
            </div>
            <Link to="/menu" className="text-gold browse-link">{t('home.curated.browseAll')}</Link>
          </div>

          <div className="curated-grid mt-5">
            {/* Mixed Platter */}
            <div className="curated-card large">
              <img src="/images/mixed-platter.jpg" alt="The Mixed Platter" className="curated-img" loading="lazy" />
              <div className="curated-overlay">
                <p className="text-sm font-bold" style={{ color: '#F97316', letterSpacing: '2px' }}>{t('home.curated.chefsPick')}</p>
                <h3 className="curated-title" style={{ color: '#F97316', textTransform: 'uppercase' }}>{t('home.curated.mixedPlatter')}</h3>
                <div className="curated-actions mt-2">
                  <Link to="/menu/platter" className="btn btn-primary btn-sm" style={{ backgroundColor: '#F97316', border: 'none', textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>{t('common.orderNow')}</Link>
                </div>
              </div>
            </div>

            {/* Burger */}
            <div className="curated-card small">
              <img src="/images/habibi-burger.jpg" alt="Habibi Bergers" className="curated-img" loading="lazy" />
              <div className="curated-overlay">
                <h3 className="curated-title" style={{ color: '#F97316', textTransform: 'uppercase' }}>{t('home.curated.habibiBergers')}</h3>
                <p className="curated-price text-sm font-bold" style={{ color: '#F97316' }}>$6.49</p>
                <div className="curated-actions mt-2">
                  <Link to="/menu/burgers" className="btn btn-outline-light btn-sm btn-full" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>{t('common.orderNow')}</Link>
                </div>
              </div>
            </div>

            {/* Halal Certified Info */}
            <div className="curated-card info-card">
              <Shield size={32} color="var(--color-primary)" />
              <h3 className="info-card-title mt-3">{t('home.curated.halalCertifiedTitle')}</h3>
              <p className="info-card-desc mt-2">
                {t('home.curated.halalCertifiedDesc')}
              </p>
              <Link to="/health-safety" className="text-gold browse-link mt-4">{t('home.curated.ourStandards')}</Link>
            </div>

            {/* Halal Salad */}
            <div className="curated-card wide">
              <img src="/images/halal-salad-v2.jpg" alt="Halal Salad" className="curated-img" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WALL OF LOVE (REVIEWS)
      ═══════════════════════════════════════════════════════ */}
      <section className="section reviews-section">
        <div className="container text-center">
          <p className="section-eyebrow text-gold">{t('home.reviews.fansEyebrow')}</p>
          <h2 className="heading-2 mb-5">{t('home.reviews.wallOfLove')}</h2>
          
          <div className="reviews-marquee-container">
            <div className="reviews-marquee-content">
              {Array.from({ length: 2 }).map((_, loopIdx) => (
                <React.Fragment key={loopIdx}>
                  {EDITORIAL_REVIEWS.map((rev, idx) => (
                    <div key={`${loopIdx}-${idx}`} className="review-card">
                      <div className="stars">
                        {Array.from({ length: rev.stars }).map((_, i) => (
                          <Star key={i} size={16} fill="#fbbf24" color="#fbbf24" />
                        ))}
                      </div>
                      <p className="review-text">"{rev.text}"</p>
                      <div className="reviewer">
                        <img src={rev.logo} alt={rev.name} className="reviewer-img" />
                        <div className="reviewer-info">
                          <h4 className="reviewer-name">{rev.name}</h4>
                          <p className="reviewer-type">{rev.type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          LIVE CUSTOMER REVIEWS (from backend)
      ═══════════════════════════════════════════════════════ */}
      {liveReviews.length > 0 && (
        <section className="section customer-reviews-section">
          <div className="container text-center">
            <p className="section-eyebrow text-gold">{t('home.reviews.verifiedEyebrow')}</p>
            <h2 className="heading-2 mb-2">{t('home.reviews.whatCustomersSay')}</h2>
            {reviewStats && (
              <div className="rev-stats-bar">
                <span className="rev-stats-avg">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} size={16} fill={n <= Math.round(reviewStats.avg_rating) ? '#E5B64E' : 'none'} color="#E5B64E" />
                  ))}
                </span>
                <span className="rev-stats-label">
                  {parseFloat(reviewStats.avg_rating).toFixed(1)} {t('home.reviews.outOf5')} &nbsp;·&nbsp; {reviewStats.total} {t('home.reviews.reviewsCount')}
                </span>
              </div>
            )}
            <div className="customer-reviews-grid mt-4">
              {liveReviews.map(r => (
                <div key={r.id} className="customer-review-card">
                  <div className="customer-stars">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={14} fill={n <= r.rating ? '#E5B64E' : 'none'} color="#E5B64E" />
                    ))}
                  </div>
                  {r.comment && <p className="customer-review-text">"{r.comment}"</p>}
                  <div className="customer-reviewer">
                    <span className="customer-reviewer-name">{r.customer_name}</span>
                    <span className="customer-reviewer-date">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {r.reply && (
                    <div className="customer-reply">
                      <span className="customer-reply-label">{t('home.reviews.habibiReplied')}</span>
                      <p className="customer-reply-text">{r.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          BEYOND THE PLATE
      ═══════════════════════════════════════════════════════ */}
      <section className="section beyond-section">
        <div className="container beyond-container">
          <div className="beyond-content">
            <h2 className="heading-2 mb-5">{t('home.beyond.title')}</h2>

            <div className="feature-item">
              <div className="feature-icon">
                <Sparkles size={20} color="var(--color-primary)" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">{t('home.beyond.craftTitle')}</h4>
                <p className="feature-desc">
                  {t('home.beyond.craftDesc')}
                </p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <Shield size={20} color="var(--color-primary)" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">{t('home.beyond.excellenceTitle')}</h4>
                <p className="feature-desc">
                  {t('home.beyond.excellenceDesc')}
                </p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <Eye size={20} color="var(--color-primary)" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">{t('home.beyond.presentationTitle')}</h4>
                <p className="feature-desc">
                  {t('home.beyond.presentationDesc')}
                </p>
              </div>
            </div>
          </div>

          <div className="beyond-image-wrapper">
            <img src="/images/chef-plating.jpg" alt="Chef Plating" className="beyond-img" loading="lazy" />
            <div className="beyond-quote-box">
              <p className="quote-text">
                "Habibi Halal Express has put a modern, upscale spin on Mediterranean classics, delivering fantastic flavor and artisan presentation."
              </p>
              <p className="quote-author">NY FOODIE MAG</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SCROLLING MARQUEE
      ═══════════════════════════════════════════════════════ */}
      <section className="marquee-section">
        <div className="marquee-container">
          <div className="marquee-content">
            {/* We duplicate the items to create a seamless infinite scroll effect */}
            {Array.from({ length: 2 }).map((_, i) => (
              <React.Fragment key={i}>
                <span className="marquee-item">{t('home.marquee.halal')} <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">{t('home.marquee.local')} <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">{t('home.marquee.spices')} <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">{t('home.marquee.chefs')} <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">{t('home.marquee.finest')} <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">{t('home.marquee.handcrafted')} <Sparkles size={28} className="marquee-icon"/></span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          RESTAURANT BANNER
      ═══════════════════════════════════════════════════════ */}
      <section className="restaurant-banner-section">
        <div className="rb-bg">
          <img src="/images/banners/restaurant-banner-v2.jpg" alt="Habibi Halal Express Restaurant" className="rb-bg-img" />
          <div className="rb-overlay" />
          {/* Animated gradient sweep */}
          <div className="rb-sweep" aria-hidden="true" />
        </div>

        <div className="rb-content container">
          {/* Left column — main copy */}
          <div className="rb-left">
            <p className="rb-eyebrow">
              <span className="rb-eyebrow-line" />
              {t('home.banner.eyebrow')}
            </p>
            <h2 className="rb-title">
              {t('home.banner.titleLine1')}<br />
              <span className="rb-title-accent">{t('home.banner.titleLine2')}</span>
            </h2>
            <p className="rb-desc">
              {t('home.banner.desc')}
            </p>

            {/* Animated quote lines */}
            <div className="rb-lines">
              <div className="rb-line">
                <span className="rb-line-icon">🔥</span>
                <span>{t('home.banner.line1')}</span>
              </div>
              <div className="rb-line">
                <span className="rb-line-icon">🌿</span>
                <span>{t('home.banner.line2')}</span>
              </div>
              <div className="rb-line">
                <span className="rb-line-icon">❤️</span>
                <span>{t('home.banner.line3')}</span>
              </div>
              <div className="rb-line">
                <span className="rb-line-icon">🚀</span>
                <span>{t('home.banner.line4')}</span>
              </div>
            </div>

            <div className="rb-cta-row">
              <Link to="/menu" className="rb-btn-primary">{t('common.orderNow')}</Link>
              <Link to="/about" className="rb-btn-ghost">{t('home.banner.ourStory')}</Link>
            </div>
          </div>

          {/* Right column — trust badges */}
          <div className="rb-right">
            <div className="rb-badges-grid">
              <div className="rb-badge">
                <span className="rb-badge-icon">🏆</span>
                <p className="rb-badge-num">10K+</p>
                <p className="rb-badge-label">{t('home.stats.happyCustomers')}</p>
              </div>
              <div className="rb-badge">
                <span className="rb-badge-icon">⭐</span>
                <p className="rb-badge-num">4.9</p>
                <p className="rb-badge-label">{t('home.banner.averageRating')}</p>
              </div>
              <div className="rb-badge">
                <span className="rb-badge-icon">📍</span>
                <p className="rb-badge-num">3</p>
                <p className="rb-badge-label">{t('home.stats.bronxLocations')}</p>
              </div>
              <div className="rb-badge">
                <span className="rb-badge-icon">⏰</span>
                <p className="rb-badge-num">24/7</p>
                <p className="rb-badge-label">{t('home.banner.bedfordParkOpen')}</p>
              </div>
            </div>

            <div className="rb-pull-quote">
              <span className="rb-pull-quote-mark">"</span>
              <p>The Bronx's crown jewel of authentic Halal cuisine, bold flavors, perfect every single time.</p>
              <p className="rb-pull-quote-author">NY Foodie Magazine</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          LOCATIONS
      ═══════════════════════════════════════════════════════ */}
      <section className="section locations-section">
        <div className="container text-center">
          <p className="section-eyebrow text-gold">{t('home.locations.eyebrow')}</p>
          <h2 className="heading-2">{t('home.locations.title')}</h2>
          <p className="section-desc mx-auto mt-3">
            {t('home.locations.desc')}
          </p>

          <div className="locations-grid mt-5">

            <div className="location-card">
              <div className="location-img-wrapper">
                <img src="/images/locations/bedford-park.webp" alt="Bedford Park" className="location-img" />
                <span className="location-badge outline">{t('home.locations.open247')}</span>
              </div>
              <div className="location-info">
                <h3 className="location-title">{t('home.locations.bedfordPark')}</h3>
                <p className="location-address">2974 Jerome Ave, Bronx, NY 10468</p>
                <p className="location-hours">{t('home.locations.hours')}</p>
                <Link to="/menu" className="location-link text-gold">{t('home.locations.orderNow')} <ChevronRight size={14}/></Link>
              </div>
            </div>

            <div className="location-card">
              <div className="location-img-wrapper">
                <img src="/images/locations/kings-bridge.webp" alt="Kingsbridge Road" className="location-img" />
                <span className="location-badge outline">{t('home.locations.nowOpen')}</span>
              </div>
              <div className="location-info">
                <h3 className="location-title">{t('home.locations.kingsbridge')}</h3>
                <p className="location-address">2 E Kingsbridge Rd, Bronx, NY 10468</p>
                <p className="location-hours">{t('home.locations.hours')}</p>
                <Link to="/menu" className="location-link text-gold">{t('home.locations.orderNow')} <ChevronRight size={14}/></Link>
              </div>
            </div>

            <div className="location-card">
              <div className="location-img-wrapper">
                <img src="/images/locations/white-plains.webp" alt="White Plains Road" className="location-img" />
                <span className="location-badge outline">{t('home.locations.nowOpen')}</span>
              </div>
              <div className="location-info">
                <h3 className="location-title">{t('home.locations.whitePlains')}</h3>
                <p className="location-address">3971 White Plains Rd, Bronx, NY 10466</p>
                <p className="location-hours">{t('home.locations.hours')}</p>
                <Link to="/menu" className="location-link text-gold">{t('home.locations.orderNow')} <ChevronRight size={14}/></Link>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
