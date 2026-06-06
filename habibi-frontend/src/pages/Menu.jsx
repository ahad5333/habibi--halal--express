import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingBag, Star, ChevronRight } from 'lucide-react';
import { menuAPI, favoritesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import './Menu.css';

const CATEGORIES = [
  { label: 'All',            value: 'all',       match: null,                         emoji: '🍽️' },
  { label: 'Breakfast',      value: 'breakfast', match: 'Breakfast at YOUR OWN TIME', emoji: '🌅' },
  { label: 'Platter',        value: 'platter',   match: 'Platter',                    emoji: '🥗' },
  { label: 'Sandwich',       value: 'sandwich',  match: 'Sandwich',                   emoji: '🥙' },
  { label: 'Burgers',        value: 'burgers',   match: 'Burgers',                    emoji: '🍔' },
  { label: 'Drinks',         value: 'drinks',    match: 'Drinks',                     emoji: '🥤' },
  { label: 'Family Tray',    value: 'family',    match: 'Family Tray',                emoji: '🍽️' },
  { label: 'Extras',         value: 'extras',    match: 'Extras',                     emoji: '➕' },
  { label: 'Specials',       value: 'specials',  match: 'Habibi Specials',            emoji: '⭐' },
  { label: 'Build Your Own', value: 'byo',       match: 'Build Your Own',             emoji: '🏗️' },
];

const fallbackImg = (id, idx = 0) =>
  `/images/menu/${((id ?? idx) % 70) + 1}.jpg`;

const toWebp = url =>
  url && /\.(jpe?g|png)$/i.test(url)
    ? url.replace(/\.(jpe?g|png)$/i, '.webp')
    : url;

const Menu = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'all');
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const { items: cartItems, subtotal } = useCart();
  const { user, isLoggedIn } = useAuth();
  const tabsRef = useRef(null);

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
    setActiveCategory(val);
    const next = new URLSearchParams(searchParams);
    if (val === 'all') next.delete('cat');
    else next.set('cat', val);
    setSearchParams(next, { replace: true });
  };

  const activeCatObj = CATEGORIES.find(c => c.value === activeCategory);

  const filtered = items.filter(item => {
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
      catMatch = item.category === activeCatObj?.match;
    }
    const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const searchMatch = words.length === 0 || words.every(w => {
      const searchable = [
        item.name || item.title || '',
        item.description || '',
        item.category || '',
      ].join(' ').toLowerCase();
      return searchable.includes(w);
    });
    return catMatch && searchMatch;
  });

  const handleCardClick = item => {
    navigate(`/menu/${item.id}`);
  };

  return (
    <div className="menu-page">
      <SEO
        title="Menu | Authentic Halal Platters, Gyros & Burgers"
        description="Explore the Habibi Halal Express menu. Order online: Chicken over Rice, Gyro Platters, Philly Cheesesteaks, and Burgers."
        keywords="halal menu, gyros, chicken over rice platter, philly cheesesteak, halal burgers bronx"
        schema={items.length > 0 ? menuSchema : null}
      />

      {/* ══════════ HEADER BANNER ══════════ */}
      <div className="menu-header">
        <div className="menu-header-overlay" />
        <div className="menu-header-content">
          <img
            src="/images/hero/halal-certified.png"
            alt="Halal Certified"
            className="menu-header-halal"
          />
          <h1 className="menu-header-title">Menu</h1>
          <p className="menu-header-sub">
            Every dish crafted with tradition, precision &amp; passion
          </p>
        </div>
      </div>

      {/* ══════════ SEARCH BAR ══════════ */}
      <div className="menu-search-bar">
        <div className="menu-search-inner">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="menu-search-input"
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {/* ══════════ HORIZONTAL CATEGORY TABS ══════════ */}
      <div className="menu-cats-wrap">
        <div className="menu-cats-track" ref={tabsRef}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`menu-cat-tab${activeCategory === cat.value ? ' active' : ''}`}
              onClick={() => handleCatClick(cat.value)}
            >
              <span className="menu-cat-emoji">{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ MAIN GRID ══════════ */}
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

        {loading ? (
          <div className="menu-loading">
            <div className="menu-spinner" />
            <p>Loading menu...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="menu-empty">
            <p>No items found{search ? ` for "${search}"` : ' in this category'}.</p>
            <button className="menu-empty-reset" onClick={() => { setSearch(''); handleCatClick('all'); }}>
              Show all items
            </button>
          </div>
        ) : (
          <div className="menu-grid">
            {filtered.map((item, idx) => {
              const imgSrc  = item.image || item.image_url || fallbackImg(item.id, idx);
              const name    = item.name || item.title || 'Menu Item';
              const price   = parseFloat(item.price || 0);
              const isFav   = favoriteIds.has(item.id);
              const catLabel = (item.category || '').toLowerCase().includes('berger')
                ? 'Burgers'
                : (item.category || '').toLowerCase().includes('breakfast')
                ? 'Breakfast'
                : item.category;

              return (
                <div
                  key={item.id}
                  className="menu-card"
                  onClick={() => handleCardClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleCardClick(item)}
                >
                  {/* Image */}
                  <div className="menu-card-img-wrap">
                    <img
                      src={toWebp(imgSrc)}
                      alt={name}
                      className="menu-card-img"
                      loading="lazy"
                      decoding="async"
                      onError={e => {
                        e.target.onerror = () => { e.target.src = fallbackImg(item.id, idx + 7); };
                        e.target.src = imgSrc;
                      }}
                    />

                    {/* Favourite */}
                    {isLoggedIn && (
                      <button
                        className={`menu-fav-btn${isFav ? ' active' : ''}`}
                        onClick={e => toggleFavorite(e, item.id)}
                        aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
                      >
                        <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                    )}

                    {/* "See more" arrow overlay */}
                    <div className="menu-card-hover-overlay">
                      <span className="menu-card-view">View Item <ChevronRight size={14} /></span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="menu-card-body">
                    <h3 className="menu-card-name">{name}</h3>
                    {item.description && (
                      <p className="menu-card-desc">{item.description}</p>
                    )}
                    <div className="menu-card-footer">
                      <span className="menu-card-price">${price.toFixed(2)}</span>
                      <button
                        className="menu-card-add"
                        onClick={e => { e.stopPropagation(); navigate(`/menu/${item.id}`); }}
                        aria-label={`Add ${name} to cart`}
                      >
                        <span>+</span> Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════ STICKY CART STRIP ══════════ */}
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
    </div>
  );
};

export default Menu;
