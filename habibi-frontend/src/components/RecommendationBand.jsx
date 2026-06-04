import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './RecommendationBand.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const TYPE_META = {
  popular:    { label: 'Popular Right Now',           icon: '🔥' },
  for_you:    { label: 'Recommended for You',         icon: '✨' },
  also_liked: { label: 'Customers Also Loved',        icon: '❤️' },
  new:        { label: "New — You Haven't Tried Yet", icon: '🆕' },
};

const getFallbackImg = (id) => `/images/menu/${((id || 1) % 70) + 1}.jpg`;
const toWebp = (url) =>
  url && /\.(jpe?g|png)$/i.test(url) ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;

export default function RecommendationBand({
  type = 'popular',
  email = null,
  itemName = null,
  title = null,
}) {
  const [items, setItems]  = useState([]);
  const [loading, setLoad] = useState(true);
  const [addedId, setAdded] = useState(null);
  const scrollRef  = useRef(null);
  const dragRef    = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const { addItem } = useCart();

  useEffect(() => {
    const params = new URLSearchParams({ type });
    if (email)    params.set('email', email);
    if (itemName) params.set('item_name', itemName);

    fetch(`${API_BASE}/api/ai/recommendations?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.items?.length) {
          const seen = new Set();
          const unique = data.items.filter(item => {
            const key = (item.name || '').toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setItems(unique);
        }
      })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [type, email, itemName]);

  /* ── Mouse drag-to-scroll ── */
  const onMouseDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    el.style.cursor = 'grabbing';
  };

  const onMouseMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const el = scrollRef.current;
    const x  = e.pageX - el.offsetLeft;
    const walk = (x - d.startX) * 1.2;
    if (Math.abs(walk) > 4) d.moved = true;
    el.scrollLeft = d.scrollLeft - walk;
  };

  const onMouseUp = () => {
    dragRef.current.active = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };

  const handleAdd = (item) => {
    addItem({
      id:    item.id,
      name:  item.name,
      price: parseFloat(item.price || 0),
      img:   item.image_url || getFallbackImg(item.id),
      tag:   'Recommended',
      note:  '',
      qty:   1,
    });
    setAdded(item.id);
    setTimeout(() => setAdded(null), 1800);
  };

  if (loading || items.length === 0) return null;

  const meta      = TYPE_META[type] || TYPE_META.popular;
  const bandTitle = title || `${meta.icon} ${meta.label}`;

  return (
    <div className="rb-root">
      <div className="rb-header">
        <div className="rb-title-wrap">
          <Sparkles size={15} className="rb-sparkle" />
          <h3 className="rb-title">{bandTitle}</h3>
        </div>
        <span className="rb-drag-hint">‹ drag to scroll ›</span>
      </div>

      <div
        className="rb-track"
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {items.map(item => (
          <div key={item.id} className="rb-card">
            <div className="rb-img-wrap">
              <img
                src={toWebp(item.image_url || getFallbackImg(item.id))}
                alt={item.name}
                className="rb-img"
                loading="lazy"
                decoding="async"
                onError={e => {
                  e.target.onerror = () => { e.target.src = getFallbackImg(item.id); };
                  e.target.src = item.image_url || getFallbackImg(item.id);
                }}
                draggable={false}
              />
            </div>
            <div className="rb-card-body">
              <p className="rb-item-name">{item.name}</p>
              <p className="rb-item-price">${parseFloat(item.price || 0).toFixed(2)}</p>
            </div>
            <button
              className={`rb-add-btn ${addedId === item.id ? 'added' : ''}`}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => !dragRef.current.moved && handleAdd(item)}
              aria-label={`Add ${item.name} to cart`}
            >
              {addedId === item.id ? '✓ Added' : <><Plus size={13} /> Add</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
