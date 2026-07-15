import React, { useState } from 'react';
import { Play, Clock, Eye } from 'lucide-react';

export const IGIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.246 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.246-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608C4.516 2.497 5.783 2.226 7.149 2.163 8.415 2.105 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.197.157 3.355.673 2.014 2.014.673 3.355.157 5.197.072 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.085 1.855.601 3.697 1.942 5.038 1.341 1.341 3.183 1.857 5.038 1.942C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.855-.085 3.697-.601 5.038-1.942 1.341-1.341 1.857-3.183 1.942-5.038.058-1.28.072-1.689.072-4.948s-.014-3.668-.072-4.948c-.085-1.855-.601-3.697-1.942-5.038C20.645.673 18.803.157 16.948.072 15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

export const VIDEOS = [
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
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Our Locations',
    title: 'Bedford Park Blvd — Our Flagship Location Tour',
    desc: 'Take a walk through our original location with General Manager Omar.',
    duration: '2:55',
    views: '5.3K',
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'How We Cook',
    title: 'Lamb Kofta: From Grind to Grill',
    desc: 'Watch our pitmaster prepare the signature Kofta blend using our secret spice mix.',
    duration: '5:10',
    views: '9.8K',
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Behind the Scenes',
    title: 'Catering a 300-Person Wedding — Habibi Style',
    desc: 'Our catering team mobilizes across two locations for the Bronx\'s biggest halal event.',
    duration: '8:44',
    views: '31.2K',
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Customer Stories',
    title: 'Habibi Through the Eyes of a First-Timer',
    desc: 'A first-time visitor from Queens tries our Mixed Grill Platter for the first time.',
    duration: '2:20',
    views: '14.6K',
  },
  {
    id: 'dQw4w9WgXcQ',
    category: 'Our Locations',
    title: 'White Plains Road — Now Open',
    desc: 'The newest Habibi location opens its doors. Here\'s what\'s inside.',
    duration: '3:05',
    views: '7.9K',
  },
];

export const VideoCard = ({ video, large = false }) => {
  const [playing, setPlaying] = useState(false);
  const isIG = video.type === 'instagram';

  const embedSrc = `https://www.youtube.com/embed/${video.id}?autoplay=1&mute=1&rel=0`;
  const igUrl    = `https://www.instagram.com/reel/${video.id}/`;
  const thumbnail = isIG
    ? '/images/food/background.png'
    : `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;

  const handleClick = () => {
    if (isIG) window.open(igUrl, '_blank', 'noopener,noreferrer');
    else setPlaying(true);
  };

  return (
    <div className={`vid-card ${large ? 'vid-card-large' : ''} ${isIG ? 'vid-card-ig' : ''}`}>
      <div className="vid-thumb" onClick={handleClick}>
        {playing && !isIG ? (
          <iframe
            src={embedSrc}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <img src={thumbnail} alt={video.title} onError={e => { e.target.src = '/images/food/kitchen.jpg'; }} />
            <div className="vid-overlay">
              <button className="vid-play-btn" aria-label={isIG ? 'View on Instagram' : 'Play video'}>
                {isIG ? <IGIcon size={large ? 28 : 20} /> : <Play size={large ? 32 : 22} fill="currentColor" />}
              </button>
              {isIG && <span className="vid-ig-cta">View on Instagram</span>}
            </div>
            {isIG && <span className="vid-platform-badge"><IGIcon size={13} /> Instagram</span>}
            {video.duration && <span className="vid-duration">{video.duration}</span>}
          </>
        )}
      </div>
      <div className="vid-info">
        <span className="vid-cat">{video.category}</span>
        <h3 className="vid-title">{video.title}</h3>
        {large && <p className="vid-desc">{video.desc}</p>}
        <div className="vid-meta">
          {video.views    && <span><Eye size={12} /> {video.views} views</span>}
          {video.duration && <span><Clock size={12} /> {video.duration}</span>}
          {isIG           && <span className="vid-meta-ig"><IGIcon size={11} /> Reel</span>}
        </div>
      </div>
    </div>
  );
};
