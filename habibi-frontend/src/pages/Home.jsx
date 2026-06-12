import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronRight, ChevronLeft, Sparkles, Shield, Eye, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  "telephone": "+1-718-561-0001",
  "priceRange": "$$",
  "menu": "https://habibihalalexpress.com/menu",
  "servesCuisine": ["Halal", "Mediterranean", "Middle Eastern", "Platters", "Gyros", "Burgers"],
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

const TIME_SLOTS = [
  '11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM',
  '2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM',
  '5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM','7:30 PM',
  '8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM',
];

const STATS = [
  { value: 500,  suffix: '+', label: 'Menu Items',      icon: '🍽️' },
  { value: 10,   suffix: 'K+', label: 'Happy Customers', icon: '❤️' },
  { value: 3,    suffix: '',   label: 'Bronx Locations', icon: '📍' },
  { value: 100,  suffix: '%',  label: 'Halal Certified', icon: '✅' },
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

function StatCard({ icon, value, suffix, label, animate }) {
  const count = useCountUp(value, 1600, animate);
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div className="stat-value">
        {count}{suffix}
      </div>
      <div className="stat-label">{label}</div>
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
  const navigate = useNavigate();
  const [liveReviews, setLiveReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [featItems, setFeatItems] = useState([]);
  const carouselRef = useRef(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState({ location: '', party: '', date: '', time: '', name: '', contact: '', notes: '' });
  const [bookingStatus, setBookingStatus] = useState('');

  const handleBooking = async (e) => {
    e.preventDefault();
    setBookingStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/reservations/table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });
      if (!res.ok) throw new Error();
      setBookingStatus('ok');
    } catch {
      setBookingStatus('error');
    }
  };

  const [typedText, setTypedText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const words = ["Street Food", "Gourmet Bowls", "Sizzling Platters"];
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
        description="Order fresh, healthy halal platters, gyros, burgers, and sides from Habibi Halal Express. Serving the Bronx, NY, with fast delivery and premium ingredients."
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
          
          <div className="hero-halal-badge">
            <img src="/images/hero/halal-certified.png" alt="Halal Certified" className="halal-img" />
          </div>

          <div className="floating-ingredients">
          </div>

          {/* ── Giant logo watermark behind hero content ── */}
          <div className="hero-logo-watermark" aria-hidden="true">
            <img src="/images/logos/logo-badge.png" alt="" />
          </div>

          <div className="container hero-content">
            <h1 className="hero-title-exact">
              <span className="hero-title-line-1">Savor the Flavor of</span><br />
              <span className="hero-title-line-2">Halal Perfection</span><br />
              <span className="hero-title-line-3"><span className="animated-hero-words">{typedText}<span className="typewriter-cursor">|</span></span></span>
            </h1>

            <p className="hero-creative-line">
              ~ Where Every Bite is Blessed — fresh, bold &amp; made with love ~
            </p>
            
            <div className="hero-cta-group">
              <Link to="/menu" className="hero-btn-primary">Order Now</Link>
              <Link to="/menu" className="hero-btn-ghost">View Menu</Link>
            </div>

          </div>
          
        </div>

        <div className="hero-bottom-light">
          <div className="container text-center">
            <h2 className="hero-bottom-title-exact">
              Fresh, Healthy &amp; Delivered<br />
              Right To Your Door
            </h2>

            <div className="hero-food-wrapper">
              <img src="/images/hero/round_food.webp" alt="Delicious Food" className="hero-food-img" />
            </div>
            
            <p className="hero-bottom-desc-exact">
              100% certified halal, cooked fresh to order — never frozen, never rushed.<br />
              Rooted in the Bronx and built on family recipes passed down through generations,<br />
              every dish carries the bold flavors of authentic halal cuisine. Juicy burgers,<br />
              seasoned grilled chicken, loaded rice platters — delivered straight to your door.
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
              PERSONALIZE YOUR MEAL
            </div>
            <h3 className="byo-strip-title">
              Build Your Own<br />
              <span className="byo-strip-title-accent">Habibi Bowl</span>
            </h3>
            <p className="byo-strip-desc">
              Layer your perfect bowl — fresh base, halal protein, bold toppings &amp; signature sauces.
              Over <strong>100+</strong> combinations await.
            </p>
            {/* Step indicators */}
            <div className="byo-steps">
              {['Base', 'Protein', 'Toppings', 'Sauce'].map((step, i) => (
                <div key={step} className="byo-step">
                  <div className="byo-step-num">{i + 1}</div>
                  <span className="byo-step-label">{step}</span>
                </div>
              ))}
            </div>
            <Link to="/menu?cat=byo" className="byo-strip-btn">
              <span>Start Building</span>
              <span className="byo-strip-btn-arrow"><ChevronRight size={18} /></span>
            </Link>
          </div>

          {/* Right — floating bowl image */}
          <div className="byo-strip-right">
            <div className="byo-bowl-glow" aria-hidden="true" />
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
            <p className="section-eyebrow text-gold">CULINARY HERITAGE</p>
            <h2 className="heading-2 story-title">Our Story</h2>
            <p className="story-lead mt-3">
              Rooted in the vibrant streets of the Bronx, Habibi Halal Express was born out of a passion for authentic Mediterranean flavors and family-founded Halal cooking traditions.
            </p>
            <p className="story-text mt-3">
              We bring the golden grills of the Mediterranean right to NYC, sourcing only premium, 100% Zabiha Halal certified ingredients. Every dish is seasoned with our secret blend of spices, perfected over generations, and prepared fresh daily.
            </p>
            <div className="story-highlights mt-4">
              <div className="story-highlight-item">
                <span className="story-highlight-number">100%</span>
                <span className="story-highlight-label">Zabiha Halal Certified</span>
              </div>
              <div className="story-highlight-item">
                <span className="story-highlight-number">Fresh</span>
                <span className="story-highlight-label">Never Frozen Ingredients</span>
              </div>
              <div className="story-highlight-item">
                <span className="story-highlight-number">Bronx</span>
                <span className="story-highlight-label">Local Heritage & Roots</span>
              </div>
            </div>
          </div>
          <div className="story-image-col">
            <div className="story-image-frame">
              <img src="/images/story-chef.webp" alt="Fresh authentic halal culinary preparation" className="story-main-img" loading="lazy" />
              <div className="story-image-overlay-card">
                <span className="overlay-card-title">Est. 2018</span>
                <span className="overlay-card-desc">Handcrafted with Love</span>
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
          <p className="section-eyebrow text-gold">HABIBI'S SIGNATURE</p>
          <h2 className="heading-2">The Art of the Feast</h2>

          <div className="feast-thumbs mt-5">
            {FEAST_VIDEOS.map((src, i) => (
              <div key={i} className="feast-thumb">
                <FeastVideo src={src} />
              </div>
            ))}
          </div>

          <p className="feast-desc mt-4">
            From the golden grills of the Mediterranean right to your plates, witness the passion that goes into every dish we serve.
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
              <h2 className="heading-2">Curated Selections</h2>
              <p className="section-desc mt-2">
                Our signature dishes are crafted with carefully sourced ingredients and slow-roasted Halal traditions.
              </p>
            </div>
            <Link to="/menu" className="text-gold browse-link">Browse all menu items</Link>
          </div>

          <div className="curated-grid mt-5">
            {/* Mixed Platter */}
            <div className="curated-card large">
              <img src="/images/mixed-platter.jpg" alt="The Mixed Platter" className="curated-img" loading="lazy" />
              <div className="curated-overlay">
                <p className="text-sm font-bold" style={{ color: '#F97316', letterSpacing: '2px' }}>★ CHEF'S PICK</p>
                <h3 className="curated-title" style={{ color: '#F97316', textTransform: 'uppercase', fontFamily: "'Bebas Neue', sans-serif" }}>The Mixed Platter</h3>
                <div className="curated-actions mt-2">
                  <Link to="/menu?cat=platter" className="btn btn-outline-light btn-sm" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>Add to Bag</Link>
                  <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#F97316', border: 'none' }}>$16.99</button>
                </div>
              </div>
            </div>

            {/* Burger */}
            <div className="curated-card small">
              <img src="/images/habibi-burger.jpg" alt="Habibi Burger" className="curated-img" />
              <div className="curated-overlay">
                <h3 className="curated-title" style={{ color: '#F97316', textTransform: 'uppercase', fontFamily: "'Bebas Neue', sans-serif" }}>Habibi Burger</h3>
                <p className="curated-price text-sm font-bold" style={{ color: '#F97316' }}>$10.99</p>
                <div className="curated-actions mt-2">
                  <Link to="/menu?cat=burgers" className="btn btn-outline-light btn-sm btn-full" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>Add to Bag</Link>
                </div>
              </div>
            </div>

            {/* Halal Certified Info */}
            <div className="curated-card info-card">
              <Shield size={32} color="var(--color-primary)" />
              <h3 className="info-card-title mt-3">100% Halal Certified</h3>
              <p className="info-card-desc mt-2">
                We take pride in our strict adherence to Halal standards, sourcing top-tier ingredients from trusted origins and quality providers.
              </p>
              <div className="info-card-icon mt-4">
                <div className="icon-circle">
                  <Sparkles size={20} />
                </div>
              </div>
            </div>

            {/* Halal Salad */}
            <div className="curated-card wide">
              <img src="/images/halal-salad.jpg" alt="Halal Salad" className="curated-img" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WALL OF LOVE (REVIEWS)
      ═══════════════════════════════════════════════════════ */}
      <section className="section reviews-section">
        <div className="container text-center">
          <p className="section-eyebrow text-gold">WHAT OUR FANS SAY</p>
          <h2 className="heading-2 mb-5">Wall of Love</h2>
          
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
            <p className="section-eyebrow text-gold">VERIFIED CUSTOMERS</p>
            <h2 className="heading-2 mb-2">What Our Customers Say</h2>
            {reviewStats && (
              <div className="rev-stats-bar">
                <span className="rev-stats-avg">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} size={16} fill={n <= Math.round(reviewStats.avg_rating) ? '#E5B64E' : 'none'} color="#E5B64E" />
                  ))}
                </span>
                <span className="rev-stats-label">
                  {parseFloat(reviewStats.avg_rating).toFixed(1)} out of 5 &nbsp;·&nbsp; {reviewStats.total} reviews
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
                      <span className="customer-reply-label">Habibi replied:</span>
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
            <h2 className="heading-2 mb-5">Beyond The Plate.</h2>
            
            <div className="feature-item">
              <div className="feature-icon">
                <Sparkles size={20} color="var(--color-primary)" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">Master Craftsmanship</h4>
                <p className="feature-desc">
                  We believe great food is born from love, passion, and an unwavering dedication to quality — never cut corners, never compromised.
                </p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <Shield size={20} color="var(--color-primary)" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">Uncompromised Excellence</h4>
                <p className="feature-desc">
                  From our kitchen to your table, every plate is a showcase of true craftsmanship — built with the finest halal ingredients available.
                </p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <Eye size={20} color="var(--color-primary)" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">Seamless Presentation</h4>
                <p className="feature-desc">
                  Great food is more than taste — it's a full experience. We obsess over every detail, from the first look to the very last bite.
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
              <p className="quote-author">— NY FOODIE MAG</p>
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
                <span className="marquee-item">100% Halal Certified <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">Locally Sourced <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">Authentic Spices <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">Master Chefs <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">NYC's Finest <Sparkles size={28} className="marquee-icon"/></span>
                <span className="marquee-item">Handcrafted With Love <Sparkles size={28} className="marquee-icon"/></span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          BOOK A TABLE
      ═══════════════════════════════════════════════════════ */}
      <section className="section book-table-section">
        <div className="container">
          <div className="book-table-inner">
            <div className="book-table-content">
              <p className="section-eyebrow text-gold">DINE WITH US</p>
              <h2 className="heading-2">Reserve Your Table</h2>
              <p className="book-table-desc mt-3">
                Skip the wait. Book your table in advance and arrive to a seat ready for you — whether it's a family dinner, a birthday celebration, or just a craving that can't wait.
              </p>
              <div className="book-table-perks mt-4">
                <div className="book-perk"><span className="book-perk-icon">⚡</span><span>Instant confirmation</span></div>
                <div className="book-perk"><span className="book-perk-icon">👨‍🍳</span><span>Chef's special on request</span></div>
                <div className="book-perk"><span className="book-perk-icon">🎉</span><span>Special occasion setup</span></div>
                <div className="book-perk"><span className="book-perk-icon">📍</span><span>3 Bronx locations</span></div>
              </div>
              <button className="book-table-btn mt-5" onClick={() => { setBookingOpen(true); setBookingStatus(''); }}>
                Reserve a Table <ChevronRight size={18} />
              </button>
            </div>

            <div className="book-table-image-side">
              <div className="book-table-img-frame">
                <img
                  src="/images/restaurant-interior.jpg"
                  alt="Habibi Restaurant Interior"
                  className="book-table-img"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="book-table-img-overlay">
                  <div className="book-table-hours-card">
                    <p className="hours-card-title">Dining Hours</p>
                    <p className="hours-card-line">🕐 Bedford Park &nbsp;·&nbsp; Open 24/7</p>
                    <p className="hours-card-line">🕐 Lehman Area &nbsp;·&nbsp; 7AM – 11PM</p>
                    <p className="hours-card-line">🕐 Bronx Science &nbsp;·&nbsp; 6AM – 10PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          LOCATIONS
      ═══════════════════════════════════════════════════════ */}
      <section className="section locations-section">
        <div className="container text-center">
          <p className="section-eyebrow text-gold">THE BRONX, NY</p>
          <h2 className="heading-2">Find Your Habibi</h2>
          <p className="section-desc mx-auto mt-3">
            Three locations across the Bronx — all open, all serving the same fresh halal you love.
          </p>

          <div className="locations-grid mt-5">

            <div className="location-card">
              <div className="location-img-wrapper">
                <img src="/images/locations/bedford-park.jpg" alt="Bedford Park" className="location-img" />
                <span className="location-badge outline">OPEN 24/7</span>
              </div>
              <div className="location-info">
                <h3 className="location-title">Bedford Park &amp; Jerome Ave</h3>
                <p className="location-address">204 E Mosholu Pkwy S, Bronx, NY 10458</p>
                <p className="location-hours">Open 24 Hours · 365 Days a Year</p>
                <p className="location-phone">(718) 367-7878</p>
                <Link to="/menu" className="location-link text-gold">Order Now <ChevronRight size={14}/></Link>
              </div>
            </div>

            <div className="location-card">
              <div className="location-img-wrapper">
                <img src="/images/locations/kings-bridge.jpg" alt="Lehman College Area" className="location-img" />
                <span className="location-badge outline">NOW OPEN</span>
              </div>
              <div className="location-info">
                <h3 className="location-title">Lehman College Area</h3>
                <p className="location-address">250 Bedford Park Blvd W, Bronx, NY 10468</p>
                <p className="location-hours">Mon–Sun: 7AM – 11PM</p>
                <p className="location-phone">(718) 367-7879</p>
                <Link to="/menu" className="location-link text-gold">Order Now <ChevronRight size={14}/></Link>
              </div>
            </div>

            <div className="location-card">
              <div className="location-img-wrapper">
                <img src="/images/locations/white-plains.jpg" alt="Bronx Science Area" className="location-img" />
                <span className="location-badge outline">NOW OPEN</span>
              </div>
              <div className="location-info">
                <h3 className="location-title">Bronx Science Area</h3>
                <p className="location-address">75 W 205th St, Bronx, NY 10468</p>
                <p className="location-hours">Mon–Fri: 6AM – 10PM</p>
                <p className="location-phone">(718) 367-7880</p>
                <Link to="/menu" className="location-link text-gold">Order Now <ChevronRight size={14}/></Link>
              </div>
            </div>

          </div>
        </div>
      </section>
      {/* ═══════════════════════════════════════════════════════
          TABLE BOOKING MODAL
      ═══════════════════════════════════════════════════════ */}
      {bookingOpen && (
        <div className="booking-modal-overlay" onClick={e => e.target === e.currentTarget && setBookingOpen(false)}>
          <div className="booking-modal">
            <button className="booking-modal-close" onClick={() => setBookingOpen(false)}>✕</button>
            <div className="booking-modal-header">
              <p className="section-eyebrow text-gold" style={{ fontSize: '0.68rem' }}>HABIBI HALAL EXPRESS</p>
              <h3 className="booking-modal-title">Reserve a Table</h3>
              <p className="booking-modal-sub">Fill in the details below — we'll confirm within a few hours.</p>
            </div>

            {bookingStatus === 'ok' ? (
              <div className="booking-success">
                <span style={{ fontSize: '2rem' }}>🎉</span>
                <p>Your table is reserved! We'll reach out shortly to confirm.</p>
                <button className="booking-done-btn" onClick={() => setBookingOpen(false)}>Done</button>
              </div>
            ) : (
              <form className="booking-form" onSubmit={handleBooking}>
                <div className="booking-form-row">
                  <div className="booking-field">
                    <label>Location</label>
                    <select value={booking.location} onChange={e => setBooking({ ...booking, location: e.target.value })} required>
                      <option value="">Select location</option>
                      <option value="Bedford Park & Jerome Ave">Bedford Park &amp; Jerome Ave</option>
                      <option value="Lehman College Area">Lehman College Area</option>
                      <option value="Bronx Science Area">Bronx Science Area</option>
                    </select>
                  </div>
                  <div className="booking-field">
                    <label>Party Size</label>
                    <select value={booking.party} onChange={e => setBooking({ ...booking, party: e.target.value })} required>
                      <option value="">Guests</option>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="booking-form-row">
                  <div className="booking-field">
                    <label>Date</label>
                    <input
                      type="date"
                      value={booking.date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setBooking({ ...booking, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="booking-field">
                    <label>Time</label>
                    <select value={booking.time} onChange={e => setBooking({ ...booking, time: e.target.value })} required>
                      <option value="">Select time</option>
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="booking-form-row">
                  <div className="booking-field">
                    <label>Your Name</label>
                    <input type="text" placeholder="Full name" value={booking.name} onChange={e => setBooking({ ...booking, name: e.target.value })} required />
                  </div>
                  <div className="booking-field">
                    <label>Phone or Email</label>
                    <input type="text" placeholder="Phone or email" value={booking.contact} onChange={e => setBooking({ ...booking, contact: e.target.value })} required />
                  </div>
                </div>

                <div className="booking-field">
                  <label>Special Requests <span className="optional">(optional)</span></label>
                  <textarea
                    placeholder="Birthday setup, high chair, dietary preferences…"
                    rows={3}
                    value={booking.notes}
                    onChange={e => setBooking({ ...booking, notes: e.target.value })}
                  />
                </div>

                <button type="submit" className="booking-submit-btn" disabled={bookingStatus === 'loading'}>
                  {bookingStatus === 'loading' ? 'Reserving…' : 'Confirm Reservation'}
                </button>
                {bookingStatus === 'error' && (
                  <p className="booking-error">Something went wrong. Call us at (718) 367-7878 to book.</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
