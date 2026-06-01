import React, { useState } from 'react';
import { Play, Film, Clock, Eye } from 'lucide-react';
import './Videos.css';

const IGIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.246 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.246-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608C4.516 2.497 5.783 2.226 7.149 2.163 8.415 2.105 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.197.157 3.355.673 2.014 2.014.673 3.355.157 5.197.072 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.085 1.855.601 3.697 1.942 5.038 1.341 1.341 3.183 1.857 5.038 1.942C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.855-.085 3.697-.601 5.038-1.942 1.341-1.341 1.857-3.183 1.942-5.038.058-1.28.072-1.689.072-4.948s-.014-3.668-.072-4.948c-.085-1.855-.601-3.697-1.942-5.038C20.645.673 18.803.157 16.948.072 15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

const CATEGORIES = ['All', 'Behind the Scenes', 'Customer Stories', 'How We Cook', 'Our Locations'];

const VIDEOS = [
  {
    id: 'B8TwJe1onCE',
    category: 'Behind the Scenes',
    title: 'Habibi Halal Express — Official',
    desc: 'Get a real look at Habibi Halal Express — our kitchen, our team, and the food that keeps the Bronx coming back.',
    duration: '',
    views: '',
    featured: true,
  },
  {
    id: 'G5sBVOprZ2c',
    category: 'How We Cook',
    title: 'Habibi Halal Express — Short',
    desc: 'A quick look at the food and energy that makes Habibi Halal Express a Bronx favourite.',
    duration: '',
    views: '',
    featured: true,
  },
  {
    id: 'C1dCr3BODqJ',
    type: 'instagram',
    category: 'Behind the Scenes',
    title: 'Habibi Halal Express — Instagram Reel',
    desc: 'Follow us on Instagram for daily behind-the-scenes content straight from our kitchen.',
    duration: '',
    views: '',
    featured: true,
  },
  {
    id: 'C1NWxLqO018',
    type: 'instagram',
    category: 'Behind the Scenes',
    title: 'Habibi Halal Express — Instagram Reel 2',
    desc: 'More from behind the counter at Habibi Halal Express — real food, real people, real Bronx.',
    duration: '',
    views: '',
    featured: true,
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Customer Stories',
    title: '"It Reminds Me of Home" — Bronx Community Speaks',
    desc: 'Locals from across the Bronx share what Habibi Halal Express means to them.',
    duration: '3:48',
    views: '22.7K',
    featured: false,
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Our Locations',
    title: 'Bedford Park Blvd — Our Flagship Location Tour',
    desc: 'Take a walk through our original location with General Manager Omar.',
    duration: '2:55',
    views: '5.3K',
    featured: false,
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'How We Cook',
    title: 'Lamb Kofta: From Grind to Grill',
    desc: 'Watch our pitmaster prepare the signature Kofta blend using our secret spice mix.',
    duration: '5:10',
    views: '9.8K',
    featured: false,
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Behind the Scenes',
    title: 'Catering a 300-Person Wedding — Habibi Style',
    desc: 'Our catering team mobilizes across two locations for the Bronx\'s biggest halal event.',
    duration: '8:44',
    views: '31.2K',
    featured: false,
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Customer Stories',
    title: 'Habibi Through the Eyes of a First-Timer',
    desc: 'A first-time visitor from Queens tries our Mixed Grill Platter for the first time.',
    duration: '2:20',
    views: '14.6K',
    featured: false,
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Our Locations',
    title: 'White Plains Road — Now Open',
    desc: 'The newest Habibi location opens its doors. Here\'s what\'s inside.',
    duration: '3:05',
    views: '7.9K',
    featured: false,
  },
];

const VideoCard = ({ video, large = false }) => {
  const [playing, setPlaying] = useState(false);
  const isIG = video.type === 'instagram';

  const embedSrc = isIG
    ? `https://www.instagram.com/reel/${video.id}/embed/`
    : `https://www.youtube.com/embed/${video.id}?autoplay=1`;

  const thumbnail = isIG
    ? '/images/food/background.png'
    : `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;

  return (
    <div className={`vid-card ${large ? 'vid-card-large' : ''} ${isIG ? 'vid-card-ig' : ''}`}>
      <div className="vid-thumb" onClick={() => setPlaying(true)}>
        {playing ? (
          <iframe
            src={embedSrc}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <img
              src={thumbnail}
              alt={video.title}
              onError={e => { e.target.src = '/images/food/kitchen.jpg'; }}
            />
            <div className="vid-overlay">
              <button className="vid-play-btn" aria-label="Play video">
                <Play size={large ? 32 : 22} fill="currentColor" />
              </button>
            </div>
            {isIG && (
              <span className="vid-platform-badge">
                <IGIcon size={13} /> Instagram
              </span>
            )}
            {video.duration && <span className="vid-duration">{video.duration}</span>}
          </>
        )}
      </div>
      <div className="vid-info">
        <span className="vid-cat">{video.category}</span>
        <h3 className="vid-title">{video.title}</h3>
        {large && <p className="vid-desc">{video.desc}</p>}
        <div className="vid-meta">
          {video.views && <span><Eye size={12} /> {video.views} views</span>}
          {video.duration && <span><Clock size={12} /> {video.duration}</span>}
          {isIG && <span className="vid-meta-ig"><IGIcon size={11} /> Reel</span>}
        </div>
      </div>
    </div>
  );
};

const Videos = () => {
  const [activeCategory, setActiveCategory] = useState('All');

  const featured = VIDEOS.filter(v => v.featured);
  const filtered = VIDEOS.filter(v =>
    activeCategory === 'All' ? !v.featured : v.category === activeCategory
  );

  return (
    <div className="videos-page">

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
