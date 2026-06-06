import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingBag, ChevronRight, Check } from 'lucide-react';
import { menuAPI, favoritesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import BuildYourOwn from '../components/BuildYourOwn';
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

const BOWL_BASE_OPTIONS = [
  { id: 'rice',   label: 'Rice',   image: '/images/builder/base_rice.png' },
  { id: 'salad',  label: 'Salad',  image: '/images/builder/base_salad.png' },
  { id: 'hummus', label: 'Hummus', image: '/images/builder/base_hummus.png' },
];
const BOWL_PROTEIN_OPTIONS = [
  { id: 'chicken', label: 'Chicken', image: '/images/builder/protein_chicken.png' },
  { id: 'beef',    label: 'Beef',    image: '/images/builder/protein_beef.png' },
  { id: 'falafel', label: 'Falafel', image: '/images/builder/protein_falafel.png' },
];
const BOWL_TOPPING_OPTIONS = [
  { id: 'feta',   label: 'Feta Cheese', image: '/images/builder/topping_feta.png' },
  { id: 'olives', label: 'Olives',      image: '/images/builder/topping_olives.png' },
];
const BOWL_SAUCE_OPTIONS = [
  { id: 'white', label: 'White Sauce', image: '/images/builder/sauce_white.png' },
  { id: 'hot',   label: 'Hot Sauce',   image: '/images/builder/sauce_hot.png' },
];
const BYO_ITEM = { id: 'byo-menu', name: 'Build Your Own Bowl', price: '12.99', category: 'Build Your Own', img: '/images/personalized-bowls.jpg' };

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
  const { addItem, items: cartItems, subtotal } = useCart();
  const { user, isLoggedIn } = useAuth();
  const tabsRef = useRef(null);

  // Bowl builder state
  const [bowlBase,    setBowlBase]    = useState('');
  const [bowlProtein, setBowlProtein] = useState('');
  const [bowlTopping, setBowlTopping] = useState('');
  const [bowlSauce,   setBowlSauce]   = useState('');
  const [byoItem,     setByoItem]     = useState(null);

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

  const isBYO = item =>
    (item.category || '').toLowerCase().includes('build your own');

  const handleCardClick = item => {
    if (isBYO(item)) { setByoItem(item); return; }
    navigate(`/menu/${item.id}`);
  };

  const handleAddToCart = (item, qty = 1) => {
    addItem({
      id:    item.id,
      name:  item.name || item.title,
      price: parseFloat(item.price || 0),
      img:   item.img || item.image || item.image_url || fallbackImg(item.id),
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

        {/* ══════════ BUILD YOUR OWN BUILDER ══════════ */}
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

              {/* Live preview panel */}
              <div className="bowl-preview-panel">
                <div className="bowl-plate-wrap">
                  <div className="bowl-plate" style={{ backgroundColor: selectedBase ? '#fef9ef' : '#f5f0e8' }}>
                    {!selectedBase && !selectedProtein && !selectedTopping && !selectedSauce ? (
                      <div className="bowl-empty-state">
                        <img src="/images/builder/realistic-3d-bowl.png" alt="Bowl" className="bowl-empty-img-rotate" />
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

        {loading ? (
          <div className="menu-loading">
            <div className="menu-spinner" />
            <p>Loading menu...</p>
          </div>
        ) : filtered.length === 0 && activeCategory !== 'byo' ? (
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

      {/* ══════════ BYO MODAL ══════════ */}
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
