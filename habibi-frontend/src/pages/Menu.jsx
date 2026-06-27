import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingBag, Check, Star, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { menuAPI, favoritesAPI, reviewsAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import BuildYourOwn from '../components/BuildYourOwn';
import MenuItemModal from '../components/MenuItemModal';
import SEO from '../components/SEO';
import './Menu.css';

const CATEGORIES = [
  { label: 'All',             shortLabel: 'All',      value: 'all',       match: null,             emoji: '🍽️' },
  { label: 'Breakfast',       shortLabel: 'Breakfast', value: 'breakfast', match: 'Breakfast',      emoji: '🌅' },
  { label: 'Platter',         shortLabel: 'Platter',   value: 'platter',   match: 'Platter',        emoji: '🥗' },
  { label: 'Sandwiches',      shortLabel: 'Sandwich',  value: 'sandwich',  match: 'Sandwich',       emoji: '🥙' },
  { label: 'Burgers',         shortLabel: 'Burgers',   value: 'burgers',   match: 'Burgers',        emoji: '🍔' },
  { label: 'Tacos',           shortLabel: 'Tacos',     value: 'tacos',     match: 'Tacos',          emoji: '🌮' },
  { label: 'Habibi Specials', shortLabel: 'Specials',  value: 'specials',  match: 'Habibi Specials',emoji: '⭐' },
  { label: 'Extras',          shortLabel: 'Extras',    value: 'extras',    match: 'Extras',         emoji: '➕' },
  { label: 'Drinks',          shortLabel: 'Drinks',    value: 'drinks',    match: 'Drinks',         emoji: '🥤' },
  { label: 'Family Tray',     shortLabel: 'Family',    value: 'family',    match: 'Family Tray',    emoji: '🍽️' },
  { label: 'Build Your Own!', shortLabel: 'BYO',       value: 'byo',       match: 'Build Your Own', emoji: '🏗️', special: true },
];

// Ordered list of DB category strings for section sorting
const CAT_ORDER = [
  'Breakfast','Platter','Sandwich','Burgers','Taco','Tacos',
  'Habibi Specials','Specials','Extras','Drinks','Family Tray','Build Your Own',
];

const BOWL_BASE_OPTIONS = [
  { id: 'rice',   label: 'Rice',   image: '/images/builder/base_rice.webp' },
  { id: 'salad',  label: 'Salad',  image: '/images/builder/base_salad.webp' },
  { id: 'hummus', label: 'Hummus', image: '/images/builder/base_hummus.webp' },
];
const BOWL_PROTEIN_OPTIONS = [
  { id: 'chicken', label: 'Chicken', image: '/images/builder/protein_chicken.webp' },
  { id: 'beef',    label: 'Beef',    image: '/images/builder/protein_beef.webp' },
  { id: 'falafel', label: 'Falafel', image: '/images/builder/protein_falafel.webp' },
];
const BOWL_TOPPING_OPTIONS = [
  { id: 'feta',   label: 'Feta Cheese', image: '/images/builder/topping_feta.webp' },
  { id: 'olives', label: 'Olives',      image: '/images/builder/topping_olives.webp' },
];
const BOWL_SAUCE_OPTIONS = [
  { id: 'white', label: 'White Sauce', image: '/images/builder/sauce_white.webp' },
  { id: 'hot',   label: 'Hot Sauce',   image: '/images/builder/sauce_hot.webp' },
];
const BYO_ITEM = { id: 'byo-menu', name: 'Build Your Own Bowl', price: '12.99', category: 'Build Your Own', img: '/images/personalized-bowls.jpg' };

const fallbackImg = (id, idx = 0) => `/images/menu/${((id ?? idx) % 70) + 1}.jpg`;
const toWebp = url => url && /\.(jpe?g|png)$/i.test(url) ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;

const CATEGORY_FALLBACKS = {
  platter:       '/images/food/food-4.jpg',
  burger:        '/images/habibi-burger.jpg',
  sandwich:      '/images/food/food-3.jpg',
  breakfast:     '/images/food/food-1.jpg',
  taco:          '/images/food/food-2.jpg',
  drink:         '/images/food/food-6.jpg',
  beverage:      '/images/food/food-6.jpg',
  extra:         '/images/halal-salad.jpg',
  salad:         '/images/halal-salad.jpg',
  'build your':  '/images/personalized-bowls.jpg',
  special:       '/images/art-of-the-feast.jpg',
};

const categoryFallback = (item) => {
  const cat  = (item?.category || '').toLowerCase();
  const name = (item?.name || item?.title || '').toLowerCase();
  const hay  = `${cat} ${name}`;
  for (const [key, img] of Object.entries(CATEGORY_FALLBACKS)) {
    if (hay.includes(key)) return img;
  }
  return '/images/food/food-7.jpg';
};

const Menu = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const { addItem, items: cartItems, subtotal } = useCart();
  const { isLoggedIn } = useAuth();
  const tabsRef    = useRef(null);
  const sectionRefs = useRef({});
  const [activeSidebarCat, setActiveSidebarCat] = useState('');

  const [ratingStats, setRatingStats] = useState(null);

  const [bowlBase,    setBowlBase]    = useState('');
  const [bowlProtein, setBowlProtein] = useState('');
  const [bowlTopping, setBowlTopping] = useState('');
  const [bowlSauce,   setBowlSauce]   = useState('');
  const [byoItem,     setByoItem]     = useState(null);
  const [modalItemId, setModalItemId] = useState(null);
  const featCarouselRef = useRef(null);
  const [locAvailMap,  setLocAvailMap]  = useState({});

  const scrollFeatCarousel = dir => {
    const el = featCarouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  const menuSchema = {
    "@context": "https://schema.org",
    "@type": "Menu",
    "name": "Habibi Halal Express Menu",
    "description": "Authentic Halal menu — Platters, Gyros, Burgers, Sandwiches, Family Trays.",
  };

  useEffect(() => {
    menuAPI.getAll()
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.menus || data.items || []);
        setItems(arr);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // React to ?cat= query param — works both on first load and when already on the page
  useEffect(() => {
    const cat = searchParams.get('cat');
    if (!cat || cat === 'all') return;
    if (loading) return; // re-fires when loading flips to false
    if (cat === 'byo') { setActiveCategory('byo'); return; }
    setActiveCategory('all');
    setTimeout(() => handleCatClick(cat), 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), loading]);

  useEffect(() => {
    reviewsAPI.getApproved({ limit: 1 })
      .then(data => {
        const s = data?.stats;
        if (s && parseInt(s.total) > 0) {
          setRatingStats({
            avg:   parseFloat(s.avg_rating).toFixed(1),
            count: parseInt(s.total),
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('habibi_service_location');
    if (!stored) return;
    const { id } = JSON.parse(stored);
    if (!id) return;
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menus/location-availability?location_id=${id}`)
      .then(r => r.json())
      .then(d => setLocAvailMap(d || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setFavoriteIds(new Set()); return; }
    favoritesAPI.getAll()
      .then(data => {
        const ids = Array.isArray(data) ? data.map(f => f.menu_item_id) : [];
        setFavoriteIds(new Set(ids));
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const toggleFavorite = async (e, itemId) => {
    e.stopPropagation();
    if (!isLoggedIn) return;
    const isFav = favoriteIds.has(itemId);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      isFav ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    try {
      isFav ? await favoritesAPI.remove(itemId) : await favoritesAPI.add(itemId);
    } catch {
      setFavoriteIds(prev => {
        const next = new Set(prev);
        isFav ? next.add(itemId) : next.delete(itemId);
        return next;
      });
    }
  };

  const handleCatClick = val => {
    // BYO is a special builder — show its own view
    if (val === 'byo') {
      setActiveCategory('byo');
      return;
    }

    // "All" → show full menu, stay at current scroll position
    if (val === 'all') {
      setActiveCategory('all');
      return;
    }

    // All other categories: stay in 'all' view and scroll to the section
    const catObj = CATEGORIES.find(c => c.value === val);
    const sectionKey = catObj?.match;

    const doScroll = () => {
      if (!sectionKey) return;
      // Exact match first, then fuzzy (handles 'Taco' matching 'Tacos' in DB)
      const keyL = sectionKey.toLowerCase();
      let el = sectionRefs.current[sectionKey];
      if (!el) {
        const entry = Object.entries(sectionRefs.current).find(([k]) =>
          k.toLowerCase() === keyL || k.toLowerCase().includes(keyL) || keyL.includes(k.toLowerCase())
        );
        if (entry) { el = entry[1]; setActiveSidebarCat(entry[0]); }
      } else {
        setActiveSidebarCat(sectionKey);
      }
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (activeCategory !== 'all') {
      setActiveCategory('all');
      setTimeout(doScroll, 80);
    } else {
      doScroll();
    }

    // Scroll the active tab into view — only when the track is actually
    // horizontally scrollable (hidden on desktop, fixed grid on mobile).
    if (tabsRef.current && tabsRef.current.scrollWidth > tabsRef.current.clientWidth) {
      const activeBtn = tabsRef.current.querySelector(`[data-val="${val}"]`);
      if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const activeCatObj = CATEGORIES.find(c => c.value === activeCategory);

  const filtered = items.filter(item => {
    if ((locAvailMap[item.id] || 'available') === 'inactive') return false;
    let catMatch = false;
    if (activeCategory === 'all') {
      catMatch = true;
    } else if (activeCategory === 'breakfast') {
      catMatch = (item.category || '').toLowerCase().includes('breakfast');
    } else if (activeCategory === 'burgers') {
      const name = (item.name || item.title || '').toLowerCase();
      const cat  = (item.category || '').toLowerCase();
      catMatch = cat === 'burgers' || cat.includes('berger') ||
                 (cat === 'sandwich' && (name.includes('burger') || name.includes('berger')));
    } else {
      const m = activeCatObj?.match;
      catMatch = item.category === m ||
        (Array.isArray(item.categories) && !!m && item.categories.includes(m));
    }
    const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const searchMatch = words.length === 0 || words.every(w =>
      [item.name || item.title || '', item.description || '', item.category || '']
        .join(' ').toLowerCase().includes(w)
    );
    return catMatch && searchMatch;
  });

  // Featured section — breakfast items first, then by sort_order
  const featuredItems = useMemo(() => {
    const available = items.filter(i => i.is_available !== false && i.is_active !== false && (locAvailMap[i.id] || 'available') !== 'inactive');
    const breakfast = available.filter(i =>
      (i.category || '').toLowerCase().includes('breakfast')
    );
    // If we have enough breakfast items use those, otherwise fall back to sort_order
    const pool = breakfast.length >= 4 ? breakfast : [...available].sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      return sa !== sb ? sa - sb : a.id - b.id;
    });
    return pool.slice(0, 8);
  }, [items]);

  // Group items by category for "All" view — items can appear in multiple sections
  const categoryGroups = useMemo(() => {
    if (activeCategory !== 'all') return [];
    const groups = {};
    filtered.forEach(item => {
      // Collect all categories this item belongs to
      const allCats = new Set([
        ...(Array.isArray(item.categories) ? item.categories : []),
        item.category,
      ].filter(Boolean));
      allCats.forEach(cat => {
        if (!groups[cat]) groups[cat] = [];
        if (!groups[cat].find(i => i.id === item.id)) groups[cat].push(item);
      });
    });
    return Object.entries(groups).sort(([a], [b]) => {
      const aL = a.toLowerCase();
      const bL = b.toLowerCase();
      const ia = CAT_ORDER.findIndex(m => aL === m.toLowerCase() || aL.includes(m.toLowerCase()));
      const ib = CAT_ORDER.findIndex(m => bL === m.toLowerCase() || bL.includes(m.toLowerCase()));
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [filtered, activeCategory]);

  // Scroll spy — highlight sidebar/tab matching the section currently in view
  useEffect(() => {
    if (activeCategory !== 'all' || search) {
      setActiveSidebarCat('');
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        // Find the topmost intersecting section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSidebarCat(visible[0].target.dataset.category || '');
        }
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [categoryGroups, activeCategory, search]);


  const scrollToSection = cat => {
    const el = sectionRefs.current[cat];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isBYO = item => (item.category || '').toLowerCase().includes('build your own');

  const handleCardClick = item => {
    if (isBYO(item)) { setByoItem(item); return; }
    setModalItemId(item.id);
  };

  const handleAddToCart = (item, qty = 1) => {
    addItem({
      id:    item.id,
      name:  item.name || item.title,
      price: parseFloat(item.price || 0),
      img:   item.img || item.image || item.image_url || categoryFallback(item),
      tag:   item.category || 'Item',
      note:  item.note || '',
      qty,
    });
  };

  const selectedBase    = BOWL_BASE_OPTIONS.find(o => o.id === bowlBase);
  const selectedProtein = BOWL_PROTEIN_OPTIONS.find(o => o.id === bowlProtein);
  const selectedTopping = BOWL_TOPPING_OPTIONS.find(o => o.id === bowlTopping);
  const selectedSauce   = BOWL_SAUCE_OPTIONS.find(o => o.id === bowlSauce);
  const bowlReady = !!bowlBase && !!bowlProtein && !!bowlTopping && !!bowlSauce;

  const handleAddComposedBowl = () => {
    if (!bowlReady) return;
    const name = `BYO Bowl: ${selectedProtein.label} over ${selectedBase.label}`;
    const note = `Toppings: ${selectedTopping.label} | Sauce: ${selectedSauce.label}`;
    addItem({ ...BYO_ITEM, name, note, qty: 1 });
    setBowlBase(''); setBowlProtein(''); setBowlTopping(''); setBowlSauce('');
  };

  // ── Item row (UberEats-style horizontal) ───────────────────────
  const renderItemRow = (item, idx) => {
    const locStatus = locAvailMap[item.id] || 'available';
    if (locStatus === 'inactive') return null;

    const imgSrc   = item.image || item.image_url || categoryFallback(item);
    const name     = (item.name || item.title || 'Menu Item').replace(/\s*\(.*$/, '').trim();
    const price    = parseFloat(item.price || 0);
    const isFav    = favoriteIds.has(item.id);
    const cat      = (item.category || '').toLowerCase();
    const lname    = name.toLowerCase();
    const isHotDrink = lname.includes('hot ') || lname.includes('coffee') || lname.includes('hot chocolate');
    const isCold   = !isHotDrink && (cat.includes('drink') || cat.includes('beverage') || cat.includes('salad') || lname.includes(' salad'));
    const isSpicy  = !!item.is_spicy;
    const isTuna   = lname.includes('tuna');
    const isRoom   = cat.includes('bakery') || cat.includes('dessert') ||
                     lname.includes('donut') || lname.includes('croissant') ||
                     lname.includes('muffin') || lname.includes('danish') ||
                     lname.includes('turnover') || lname.includes('pastry') ||
                     lname.includes('bagel') || lname.includes('waffle') ||
                     lname.includes('pancake') || lname.includes('cake');
    const fxClass  = (isTuna || isRoom) ? '' : (isCold ? 'item-fx item-fx-frost' : (isSpicy ? 'item-fx item-fx-fire' : 'item-fx item-fx-steam'));
    const isSoldOut = locStatus === 'sold_out';

    return (
      <div
        key={item.id}
        className={`menu-item-row${isSoldOut ? ' menu-item-sold-out' : ''}`}
        style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
        onClick={() => !isSoldOut && handleCardClick(item)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleCardClick(item)}
      >
        {/* Left — text */}
        <div className="menu-item-row-content">
          {item.is_spicy && (
            <div className="menu-item-row-badges">
              <span className="menu-item-spicy-pill">Spicy</span>
            </div>
          )}
          <h3 className="menu-item-row-name">{name}</h3>
          {item.description && (
            <p className="menu-item-row-desc">{item.description}</p>
          )}
          <div className="menu-item-row-footer">
            <span className="menu-item-row-price">${price.toFixed(2)}</span>
            {ratingStats && (
            <span className="menu-item-row-rating">
              <Star size={11} fill="#F97316" color="#F97316" />
              {ratingStats.avg}
            </span>
            )}
          </div>
        </div>

        {/* Right — image + buttons */}
        <div className="menu-item-row-right">
          <div className="menu-item-row-img-wrap">
            <img
              src={imgSrc}
              alt={name}
              className="menu-item-row-img"
              loading="lazy"
              decoding="async"
              onLoad={e => e.target.closest('.menu-item-row-img-wrap')?.classList.add('img-loaded')}
              onError={e => {
                const t = e.target;
                t.onerror = null;
                t.src = categoryFallback(item);
                t.closest('.menu-item-row-img-wrap')?.classList.add('img-loaded');
              }}
            />
            {isSoldOut && <div className="menu-item-sold-out-overlay">SOLD OUT</div>}
            {isLoggedIn && (
              <button
                className={`menu-item-fav-btn${isFav ? ' active' : ''}`}
                onClick={e => toggleFavorite(e, item.id)}
                aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
              >
                <Heart size={11} fill={isFav ? 'currentColor' : 'none'} />
              </button>
            )}
            <button
              className="menu-item-add-btn"
              onClick={e => { e.stopPropagation(); setModalItemId(item.id); }}
              aria-label={`Add ${name}`}
            >
              +
            </button>
            {/* Full Card Visual FX Overlay */}
            {fxClass && (
              <div className={fxClass} aria-hidden="true">
                {fxClass.includes('item-fx-fire') ? (
                  <>
                    <span className="flame f1" />
                    <span className="flame f2" />
                    <span className="flame f3" />
                    <span className="spark sp1" />
                    <span className="spark sp2" />
                    <span className="spark sp3" />
                    <span className="spark sp4" />
                    <span className="spark sp5" />
                  </>
                ) : fxClass.includes('item-fx-steam') ? (
                  <>
                    <span className="smoke s1" />
                    <span className="smoke s2" />
                    <span className="smoke s3" />
                    <span className="smoke s4" />
                    <span className="smoke s5" />
                    <span className="smoke s6" />
                    <span className="smoke s7" />
                    <span className="smoke s8" />
                  </>
                ) : (
                  <>
                    <span className="frost-particle fp1" />
                    <span className="frost-particle fp2" />
                    <span className="frost-particle fp3" />
                    <span className="frost-particle fp4" />
                    <span className="frost-particle fp5" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="menu-page">
      <SEO
        title="Menu | Authentic Halal Platters, Gyros & Burgers"
        description="Explore the Habibi Halal Express menu. Order online: Chicken over Rice, Gyro Platters, Philly Cheesesteaks, and Burgers."
        keywords="halal menu, gyros, chicken over rice platter, philly cheesesteak, halal burgers bronx"
        schema={items.length > 0 ? menuSchema : null}
      />

      {/* ── Header banner ──────────────────────────────────── */}
      <div className="menu-header">
        <div className="menu-header-overlay" />
        <div className="menu-header-content">
          <img src="/images/hero/halal-certified.webp" alt="Halal Certified" className="menu-header-halal" />
          <h1 className="menu-header-title">Menu</h1>
          <p className="menu-header-sub">Every dish crafted with tradition, precision &amp; passion</p>
        </div>
      </div>

      {/* ── Restaurant info strip ──────────────────────────── */}
      <div className="menu-info-strip">
        <div className="menu-info-strip-inner">
          {ratingStats && (
          <div className="menu-info-item">
            <Star size={13} fill="#F97316" color="#F97316" />
            <span><strong>{ratingStats.avg}</strong> ({ratingStats.count >= 100 ? `${ratingStats.count}+` : ratingStats.count} ratings)</span>
          </div>
          )}
          <span className="menu-info-dot" />
          <div className="menu-info-item">
            <span>100% Zabiha Halal</span>
          </div>
          <span className="menu-info-dot" />
          <div className="menu-info-item">
            <span>Bronx, NY</span>
          </div>
          <span className="menu-info-dot" />
          <div className="menu-info-item menu-info-open">
            <span className="menu-open-dot" />
            <span>Open Now</span>
          </div>
        </div>
      </div>

      {/* ── Search bar with autocomplete ──────────────────── */}
      <div className="menu-search-bar" ref={searchRef}>
        <div className="menu-search-inner">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Type to search items…"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="menu-search-input"
            autoComplete="off"
          />
          {search && (
            <button className="search-clear" onClick={() => { setSearch(''); setShowSuggestions(false); }}>✕</button>
          )}
        </div>
        {showSuggestions && search.length >= 1 && (() => {
          const q = search.toLowerCase();
          const matches = items
            .filter(i => (i.name || i.title || '').toLowerCase().includes(q) && i.is_available !== false)
            .slice(0, 6);
          return matches.length > 0 ? (
            <ul className="menu-search-suggestions">
              {matches.map(item => (
                <li
                  key={item.id}
                  className="menu-search-suggestion-item"
                  onMouseDown={() => {
                    setSearch(item.name || item.title);
                    setShowSuggestions(false);
                  }}
                >
                  <Search size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                  <span>{item.name || item.title}</span>
                  <span className="menu-suggestion-cat">{item.category}</span>
                </li>
              ))}
            </ul>
          ) : null;
        })()}
      </div>

      {/* ── Category tabs — bottom bar on mobile, hidden on desktop ── */}
      <div
        className="menu-cats-wrap"
        style={cartItems.length > 0 ? { bottom: '62px' } : {}}
      >
        <div className="menu-cats-track" ref={tabsRef}>
          {CATEGORIES.map(cat => {
            const isActive = cat.value === 'byo'
              ? activeCategory === 'byo'
              : cat.value === 'all'
                ? activeCategory === 'all' && !activeSidebarCat
                : activeSidebarCat === cat.match;
            return (
              <button
                key={cat.value}
                data-val={cat.value}
                className={`menu-cat-tab${isActive ? ' active' : ''}${cat.special ? ' menu-cat-tab--byo' : ''}`}
                onClick={() => handleCatClick(cat.value)}
              >
                <span className="menu-cat-emoji">{cat.emoji}</span>
                <span className="menu-cat-label-mobile">{cat.shortLabel || cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two-column layout: sidebar + content ─────────── */}
      <div
        className="menu-layout"
        style={{ paddingBottom: cartItems.length > 0 ? '8.5rem' : '5rem' }}
      >

      {/* Sticky left sidebar — always visible on desktop */}
      <aside className="menu-sidebar">
        <div className="menu-sidebar-inner">
          <p className="menu-sidebar-heading">Categories</p>
          {CATEGORIES.map(cat => {
            const isActive = cat.value === 'byo'
              ? activeCategory === 'byo'
              : cat.value === 'all'
                ? activeCategory === 'all' && !activeSidebarCat
                : activeSidebarCat === cat.match;
            return (
              <button
                key={cat.value}
                className={`menu-sidebar-item${isActive ? ' active' : ''}${cat.special ? ' menu-sidebar-item--byo' : ''}`}
                onClick={() => handleCatClick(cat.value)}
              >
                <span className="menu-sidebar-emoji">{cat.emoji}</span>
                <span className="menu-sidebar-label">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="menu-content">

      {/* ── Featured / Popular section (All + no search) ──── */}
      {activeCategory === 'all' && !search && featuredItems.length > 0 && (
        <div className="mf-section">
          <div className="mf-header">
            <p className="mf-eyebrow">POPULAR PICKS</p>
            <h2 className="mf-title">Order Your Favourites</h2>
          </div>
          <div className="mf-carousel-wrap">
            <button className="mf-nav-btn mf-nav-prev" onClick={() => scrollFeatCarousel(-1)} aria-label="Previous">
              <ChevronLeft size={20} />
            </button>
            <div className="mf-track" ref={featCarouselRef}>
              {featuredItems.map((item, idx) => {
                const imgSrc = item.image || item.image_url || categoryFallback(item);
                const name   = (item.name || item.title || 'Menu Item').replace(/\s*\(.*$/, '').trim();
                const price  = parseFloat(item.price || 0);
                const sub    = (item.description || item.category || 'Halal · Fresh').slice(0, 32);
                const cat     = (item.category || '').toLowerCase();
                const lname2     = name.toLowerCase();
                const isHotDrink2 = lname2.includes('hot ') || lname2.includes('coffee') || lname2.includes('hot chocolate');
                const isCold  = !isHotDrink2 && (cat.includes('drink') || cat.includes('beverage') || cat.includes('salad') || lname2.includes(' salad'));
                const isSpicy = !!item.is_spicy;
                const isRoom2 = cat.includes('bakery') || cat.includes('dessert') ||
                                lname2.includes('donut') || lname2.includes('croissant') ||
                                lname2.includes('muffin') || lname2.includes('danish') ||
                                lname2.includes('turnover') || lname2.includes('pastry') ||
                                lname2.includes('bagel') || lname2.includes('waffle') ||
                                lname2.includes('pancake') || lname2.includes('cake');
                const fxClass = isRoom2 ? '' : (isCold ? 'item-fx item-fx-frost' : (isSpicy ? 'item-fx item-fx-fire' : 'item-fx item-fx-steam'));
                return (
                  <div
                    key={item.id}
                    className="mf-card"
                    onClick={() => handleCardClick(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && handleCardClick(item)}
                  >
                    <div className="mf-img-wrap">
                      <img
                        src={imgSrc}
                        alt={name}
                        loading="lazy"
                        onError={e => { e.target.onerror = null; e.target.src = categoryFallback(item); }}
                      />
                      {fxClass && (
                        <div className={fxClass} aria-hidden="true">
                          {fxClass.includes('item-fx-fire') ? (
                            <>
                              <span className="flame f1" />
                              <span className="flame f2" />
                              <span className="flame f3" />
                              <span className="spark sp1" />
                              <span className="spark sp2" />
                              <span className="spark sp3" />
                              <span className="spark sp4" />
                              <span className="spark sp5" />
                            </>
                          ) : fxClass.includes('item-fx-steam') ? (
                            <>
                              <span className="smoke s1" />
                              <span className="smoke s2" />
                              <span className="smoke s3" />
                              <span className="smoke s4" />
                              <span className="smoke s5" />
                              <span className="smoke s6" />
                              <span className="smoke s7" />
                              <span className="smoke s8" />
                            </>
                          ) : (
                            <>
                              <span className="frost-particle fp1" />
                              <span className="frost-particle fp2" />
                              <span className="frost-particle fp3" />
                              <span className="frost-particle fp4" />
                              <span className="frost-particle fp5" />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {idx < 3 && (
                      <span className="mf-rank">🔥 #{idx + 1} Most Liked</span>
                    )}
                    <div className="mf-body">
                      <h3 className="mf-name">{name}</h3>
                      <p className="mf-sub">{sub}</p>
                      <div className="mf-footer">
                        <span className="mf-price">${price.toFixed(2)}</span>
                        <button
                          className="mf-cart-btn"
                          onClick={e => { e.stopPropagation(); setModalItemId(item.id); }}
                          aria-label={`Add ${name}`}
                        >
                          <ShoppingCart size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="mf-nav-btn mf-nav-next" onClick={() => scrollFeatCarousel(1)} aria-label="Next">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────── */}
      <div className="menu-main-wrap">

        {/* Section heading */}
        <div className="menu-grid-header">
          <h2 className="menu-grid-title">
            {activeCatObj?.label || 'All Items'}
          </h2>
          {search && (
            <p className="menu-search-count">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
            </p>
          )}
          <span className="menu-grid-count">{filtered.length} items</span>
        </div>

        {/* ── BYO Builder ───────────────────────────────── */}
        {activeCategory === 'byo' && (
          <div className="byo-builder-wrap">
            <div className="bowls-container">
              <div className="bowls-content">
                <p className="section-eyebrow text-gold">PERSONALIZED BOWLS</p>
                <h2 className="heading-2">Build Your Own Bowl</h2>
                <p className="section-desc">Create your perfect bowl step by step. Fresh, authentic and made entirely how you like it.</p>
                <div className="bowl-builder">
                  <div className="builder-step">
                    <p className="step-title">1. CHOOSE YOUR BASE</p>
                    <div className="step-options">
                      {BOWL_BASE_OPTIONS.map(opt => (
                        <button key={opt.id} className={`btn-option${bowlBase === opt.id ? ' active' : ''}`} onClick={() => setBowlBase(opt.id)}>
                          <img src={opt.image} alt={opt.label} className="btn-option-image" />
                          {opt.label}
                          {bowlBase === opt.id && <span className="btn-option-check"><Check size={12} /></span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="builder-step">
                    <p className="step-title">2. SELECT PROTEIN</p>
                    <div className="step-options">
                      {BOWL_PROTEIN_OPTIONS.map(opt => (
                        <button key={opt.id} className={`btn-option${bowlProtein === opt.id ? ' active' : ''}`} onClick={() => setBowlProtein(opt.id)}>
                          <img src={opt.image} alt={opt.label} className="btn-option-image" />
                          {opt.label}
                          {bowlProtein === opt.id && <span className="btn-option-check"><Check size={12} /></span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="builder-step">
                    <p className="step-title">3. ADD TOPPINGS</p>
                    <div className="step-options">
                      {BOWL_TOPPING_OPTIONS.map(opt => (
                        <button key={opt.id} className={`btn-option${bowlTopping === opt.id ? ' active' : ''}`} onClick={() => setBowlTopping(opt.id)}>
                          <img src={opt.image} alt={opt.label} className="btn-option-image" />
                          {opt.label}
                          {bowlTopping === opt.id && <span className="btn-option-check"><Check size={12} /></span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="builder-step">
                    <p className="step-title">4. CHOOSE SAUCE</p>
                    <div className="step-options">
                      {BOWL_SAUCE_OPTIONS.map(opt => (
                        <button key={opt.id} className={`btn-option${bowlSauce === opt.id ? ' active' : ''}`} onClick={() => setBowlSauce(opt.id)}>
                          <img src={opt.image} alt={opt.label} className="btn-option-image" />
                          {opt.label}
                          {bowlSauce === opt.id && <span className="btn-option-check"><Check size={12} /></span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className={`btn btn-wide mt-4${bowlReady ? ' btn-primary' : ' btn-outline'}`}
                    onClick={bowlReady ? handleAddComposedBowl : undefined}
                    disabled={!bowlReady}
                  >
                    {bowlReady ? `ADD BOWL TO CART — $${BYO_ITEM.price}` : 'SELECT OPTIONS TO BUILD'}
                  </button>
                  {bowlReady && <p className="bowl-hint">Perfect! Your bowl is ready to be ordered.</p>}
                </div>
              </div>
              <div className="bowl-preview-panel">
                <div className="bowl-plate-wrap">
                  <div className="bowl-plate" style={{ backgroundColor: selectedBase ? '#fef9ef' : '#f5f0e8' }}>
                    {!selectedBase && !selectedProtein && !selectedTopping && !selectedSauce ? (
                      <div className="bowl-empty-state">
                        <img src="/images/builder/realistic-3d-bowl.webp" alt="Bowl" className="bowl-empty-img-rotate" />
                        <p className="bowl-empty-text">Your bowl awaits</p>
                      </div>
                    ) : (
                      <>
                        {selectedBase    && <div className="bowl-layer bowl-base-layer">   <img src={selectedBase.image}    alt={selectedBase.label}    className="bowl-layer-image" /></div>}
                        {selectedProtein && <div className="bowl-layer bowl-protein-layer"><img src={selectedProtein.image} alt={selectedProtein.label} className="bowl-layer-image" /></div>}
                        {selectedTopping && <div className="bowl-layer bowl-topping-layer"><img src={selectedTopping.image} alt={selectedTopping.label} className="bowl-layer-image" /></div>}
                        {selectedSauce   && <div className="bowl-layer bowl-sauce-layer">  <img src={selectedSauce.image}   alt={selectedSauce.label}   className="bowl-layer-image" /></div>}
                      </>
                    )}
                  </div>
                  <div className="bowl-rim" />
                </div>
                <div className="bowl-summary">
                  <div className={`bowl-tag-pill ${selectedBase    ? 'bowl-tag-active' : 'bowl-tag-empty'}`}>{selectedBase    ? <><img src={selectedBase.image}    className="summary-img" alt="" />{selectedBase.label}</>    : '① Base'}</div>
                  <span className="bowl-tag-sep">+</span>
                  <div className={`bowl-tag-pill ${selectedProtein ? 'bowl-tag-active' : 'bowl-tag-empty'}`}>{selectedProtein ? <><img src={selectedProtein.image} className="summary-img" alt="" />{selectedProtein.label}</> : '② Protein'}</div>
                  <span className="bowl-tag-sep">+</span>
                  <div className={`bowl-tag-pill ${selectedTopping ? 'bowl-tag-active' : 'bowl-tag-empty'}`}>{selectedTopping ? <><img src={selectedTopping.image} className="summary-img" alt="" />{selectedTopping.label}</> : '③ Toppings'}</div>
                  <span className="bowl-tag-sep">+</span>
                  <div className={`bowl-tag-pill ${selectedSauce   ? 'bowl-tag-active' : 'bowl-tag-empty'}`}>{selectedSauce   ? <><img src={selectedSauce.image}   className="summary-img" alt="" />{selectedSauce.label}</>   : '④ Sauce'}</div>
                </div>
                {bowlReady && <p className="bowl-preview-cta">Looking good! Complete in the next step.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Items ─────────────────────────────────────── */}
        {loading ? (
          <div className="menu-loading">
            <div className="menu-spinner" />
            <p>Loading menu...</p>
          </div>
        ) : activeCategory === 'all' && !search ? (
          categoryGroups.length === 0 ? (
            <div className="menu-empty">
              <p>No items available.</p>
            </div>
          ) : (
            categoryGroups.map(([category, catItems]) => (
              <div
                key={category}
                className="menu-cat-section"
                data-category={category}
                ref={el => { sectionRefs.current[category] = el; }}
              >
                <div className="menu-cat-section-hd">
                  <h3 className="menu-cat-section-title">{category}</h3>
                  <span className="menu-cat-section-count">{catItems.length} items</span>
                </div>
                <div className="menu-list">
                  {catItems.map((item, idx) => renderItemRow(item, idx))}
                </div>
              </div>
            ))
          )
        ) : filtered.length === 0 && activeCategory !== 'byo' ? (
          <div className="menu-empty">
            <p>No items found{search ? ` for "${search}"` : ' in this category'}.</p>
            <button className="menu-empty-reset" onClick={() => { setSearch(''); handleCatClick('all'); }}>
              Show all items
            </button>
          </div>
        ) : activeCategory !== 'byo' ? (
          <div className="menu-list">
            {filtered.map((item, idx) => renderItemRow(item, idx))}
          </div>
        ) : null}
      </div>

      </div>{/* /menu-content */}
      </div>{/* /menu-layout */}

      {/* ── Item detail modal ────────────────────────────── */}
      {modalItemId && (
        <MenuItemModal
          itemId={modalItemId}
          onClose={() => setModalItemId(null)}
        />
      )}

      {/* ── BYO modal ─────────────────────────────────────── */}
      {byoItem && (
        <BuildYourOwn
          item={byoItem}
          onClose={() => setByoItem(null)}
          onAdd={(item, qty) => {
            handleAddToCart(item, qty);
            setByoItem(null);
          }}
        />
      )}

      {/* ── Sticky cart strip ─────────────────────────────── */}
      {cartItems.length > 0 && (
        <div className="menu-cart-strip">
          <div className="menu-cart-strip-left">
            <ShoppingBag size={16} />
            <span className="menu-cart-count">{cartItems.reduce((s, c) => s + c.qty, 0)} items</span>
            <span className="menu-cart-names">
              {cartItems.slice(0, 2).map(ci => ci.name).join(', ')}
              {cartItems.length > 2 && ` +${cartItems.length - 2} more`}
            </span>
          </div>
          <Link to="/checkout" className="menu-cart-strip-btn">
            View Cart · ${subtotal.toFixed(2)}
          </Link>
        </div>
      )}

      {/* SVG Filters — smoke warp + fire displacement */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          {/* Organic warp for smoke blobs */}
          <filter id="smoke-warp" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.020 0.008" numOctaves="5" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="32" xChannelSelector="R" yChannelSelector="G" result="warped" />
          </filter>
          {/* Fire displacement */}
          <filter id="smoke-filter" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.003" numOctaves="2" seed="5" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </div>
  );
};

export default Menu;
