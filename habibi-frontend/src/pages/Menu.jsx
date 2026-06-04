import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Heart, Minus, Plus, ShoppingBag, Check } from 'lucide-react';
import { menuAPI, favoritesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import BuildYourOwn from '../components/BuildYourOwn';
import RecommendationBand from '../components/RecommendationBand';
import './Menu.css';

const CATEGORIES = [
  { label: 'All',            value: 'all',       match: null,                          icon: '/images/icons/cart.png' },
  { label: 'Breakfast',      value: 'breakfast', match: 'Breakfast at YOUR OWN TIME',  icon: '/images/icons/breakfast.png' },
  { label: 'Platter',        value: 'platter',   match: 'Platter',                     icon: '/images/icons/platter.png' },
  { label: 'Sandwich',       value: 'sandwich',  match: 'Sandwich',                    icon: '/images/icons/sandwich.png' },
  { label: 'Burgers',        value: 'burgers',   match: 'Burgers',                     emoji: '🍔' },
  { label: 'Drinks',         value: 'drinks',    match: 'Drinks',                      emoji: '🥤' },
  { label: 'Family Tray',    value: 'family',    match: 'Family Tray',                 emoji: '🍽️' },
  { label: 'Extras',         value: 'extras',    match: 'Extras',                      icon: '/images/icons/extras.png' },
  { label: 'Specials',       value: 'specials',  match: 'Habibi Specials',             emoji: '⭐' },
  { label: 'Build Your Own', value: 'byo',       match: 'Build Your Own',              emoji: '🏗️' },
];

const BOWL_BASE_OPTIONS = [
  { id: 'rice',   label: 'Rice',   image: '/images/builder/base_rice.png',   bg: '#fef9ef' },
  { id: 'salad',  label: 'Salad',  image: '/images/builder/base_salad.png',  bg: '#edf7ed' },
  { id: 'hummus', label: 'Hummus', image: '/images/builder/base_hummus.png', bg: '#fef4e4' },
];
const BOWL_PROTEIN_OPTIONS = [
  { id: 'chicken', label: 'Chicken', image: '/images/builder/protein_chicken.png', bg: '#fff3e6' },
  { id: 'beef',    label: 'Beef',    image: '/images/builder/protein_beef.png',    bg: '#fdecea' },
  { id: 'falafel', label: 'Falafel', image: '/images/builder/protein_falafel.png', bg: '#f9f3e3' },
];
const BOWL_TOPPING_OPTIONS = [
  { id: 'feta',   label: 'Feta Cheese', image: '/images/builder/topping_feta.png',   bg: '#f9f9f9' },
  { id: 'olives', label: 'Olives',      image: '/images/builder/topping_olives.png', bg: '#e8e8e8' },
];
const BOWL_SAUCE_OPTIONS = [
  { id: 'white', label: 'White Sauce', image: '/images/builder/sauce_white.png', bg: '#ffffff' },
  { id: 'hot',   label: 'Hot Sauce',   image: '/images/builder/sauce_hot.png',   bg: '#fce9e8' },
];
const BYO_ITEM = { id: 'byo-menu', name: 'Build Your Own Bowl', price: '12.99', category: 'Build Your Own', img: '/images/personalized-bowls.jpg' };

const getFoodPhoto = (itemId, index) => {
  const n = ((itemId ?? index) % 70) + 1;
  return `/images/menu/${n}.jpg`;
};

const toWebp = (url) =>
  url && /\.(jpe?g|png)$/i.test(url) ? url.replace(/\.(jpe?g|png)$/i, '.webp') : url;

import SEO from '../components/SEO';

const Menu = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addedId, setAddedId]       = useState(null);
  const [byoItem, setByoItem]       = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const { addItem, items: cartItems, updateQty, subtotal } = useCart();

  // Bowl builder state (used when BYO category is active)
  const [bowlBase,    setBowlBase]    = useState('');
  const [bowlProtein, setBowlProtein] = useState('');
  const [bowlTopping, setBowlTopping] = useState('');
  const [bowlSauce,   setBowlSauce]   = useState('');
  const { user, isLoggedIn } = useAuth();

  const menuSchema = {
    "@context": "https://schema.org",
    "@type": "Menu",
    "name": "Habibi Halal Express Menu",
    "description": "Browse our authentic Halal menu featuring Platters, Gyros, Burgers, Sandwiches, and family trays.",
    "hasMenuSection": CATEGORIES.filter(c => c.value !== 'all').map(cat => ({
      "@type": "MenuSection",
      "name": cat.label,
      "hasMenuItem": items
        .filter(item => {
          if (cat.match === 'Burgers') {
            return (item.category || '').toLowerCase().includes('berger') || (item.category || '').toLowerCase().includes('burger');
          }
          return (item.category || '').toLowerCase().includes(cat.value) || 
                 (item.category || '').toLowerCase().includes((cat.match || '').toLowerCase());
        })
        .slice(0, 10) // Limit to top 10 per section to keep schema lightweight
        .map(item => ({
          "@type": "MenuItem",
          "name": item.name,
          "description": item.description || '',
          "offers": {
            "@type": "Offer",
            "price": item.price,
            "priceCurrency": "USD"
          }
        }))
    }))
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
    } catch (_) {
      // revert on failure
      setFavoriteIds(prev => {
        const next = new Set(prev);
        isFav ? next.add(itemId) : next.delete(itemId);
        return next;
      });
    }
  };

  const handleCatClick = (val) => {
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
    // AND logic: every word in the query must appear somewhere in name, description, or category
    const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const searchMatch = words.length === 0 || words.every(word => {
      const searchable = [
        item.name || item.title || '',
        item.description || '',
        item.category || '',
        item.notes || '',
      ].join(' ').toLowerCase();
      return searchable.includes(word);
    });
    return catMatch && searchMatch;
  });

  const handleAddToCart = (item, qty = 1) => {
    const isBYOItem = (item.category || '').toLowerCase().includes('build your own') || (item.name || '').toLowerCase().includes('byo') || (item.title || '').toLowerCase().includes('byo');
    addItem({
      id: item.id,
      name: item.name || item.title,
      price: parseFloat(item.price || 0),
      img: isBYOItem ? '/images/personalized-bowls.jpg' : (item.image || item.image_url || getFoodPhoto(item.id, 0)),
      tag: item.category || 'Item',
      note: item.note || '',
      qty,
    });
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 1800);
  };

  const isBYO = (item) => (item.category || '').toLowerCase().includes('build your own');

  const handleCardClick = (item) => {
    if (isBYO(item)) { setByoItem(item); return; }
    handleAddToCart(item, 1);
  };

  const activeCatLabel = activeCatObj?.label || 'Menu';

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
        description="Explore the Habibi Halal Express menu. Order online: Chicken over Rice, Gyro Platters, Philly Cheesesteaks, Fresh Salads, and Burgers."
        keywords="halal menu, gyros, chicken over rice platter, philly cheesesteak, halal burgers bronx"
        schema={items.length > 0 ? menuSchema : null}
      />
      {/* Banner */}
      <div className="menu-header">
        <div className="menu-header-overlay" />
        <div className="menu-header-content">
          <img src="/images/logos/halal.png" alt="Halal Certified" className="menu-header-halal" />
          <h1 className="menu-header-title">Our Menu</h1>
          <p className="menu-header-sub">Every dish crafted with tradition, precision, and passion</p>
        </div>
      </div>

      {/* Sticky search */}
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

      {/* Body */}
      <div className="menu-body container">
        {/* Sidebar */}
        <aside className="menu-sidebar">
          <p className="sidebar-title">Categories</p>
          <ul className="category-list">
            {CATEGORIES.map(cat => (
              <li key={cat.value}>
                <button
                  className={`category-btn${activeCategory === cat.value ? ' active' : ''}`}
                  onClick={() => handleCatClick(cat.value)}
                >
                  <span className="cat-icon">
                    {cat.icon
                      ? <img src={cat.icon} alt={cat.label} />
                      : <span className="cat-emoji">{cat.emoji}</span>
                    }
                  </span>
                  <span className="cat-label">{cat.label}</span>
                  {activeCategory === cat.value && <span className="cat-active-dot" />}
                </button>
              </li>
            ))}
          </ul>

          <div className="halal-certified-box">
            <img src="/images/logos/halal.png" alt="Halal Certified" className="sidebar-halal-img" />
            <h4>Halal Certified</h4>
            <p>We source only premium, hand-slaughtered Zabiha Halal meats for every dish.</p>
          </div>
        </aside>

        {/* Main */}
        <main className="menu-main">
          <RecommendationBand
            type={user?.email ? 'for_you' : 'popular'}
            email={user?.email || null}
          />

          <div className="menu-main-header">
            <div>
              <h2 className="menu-section-title">{activeCatLabel}</h2>
              {search && (
                <p className="search-result-note">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* ── Build Your Own interactive builder ── */}
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
                    <div className="bowl-plate" style={{ backgroundColor: selectedBase ? selectedBase.bg : '#f5f0e8' }}>
                      {!selectedBase && !selectedProtein && !selectedTopping && !selectedSauce ? (
                        <div className="bowl-empty-state">
                          <img
                            src="/images/builder/realistic-3d-bowl.png"
                            alt="Realistic 3D Bowl"
                            className="bowl-empty-img-rotate"
                          />
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
              <div className="loading-spinner" />
              <p>Loading menu...</p>
            </div>
          ) : filtered.length === 0 && activeCategory !== 'byo' ? (
            <div className="menu-empty">
              <p>No items found{search ? ` for "${search}"` : ' in this category'}.</p>
            </div>
          ) : (
            <div className="menu-grid">
              {filtered.map((item, idx) => {
                const imgSrc = item.image || item.image_url || getFoodPhoto(item.id, idx);
                const name = item.name || item.title || 'Menu Item';
                const price = parseFloat(item.price || 0);
                const isAdded = addedId === item.id;
                const cat = (item.category || '').toLowerCase();
                const nameLower = name.toLowerCase();
                // Determine visual effect: smoke for hot, ice for cold drinks, none for tuna
                const isTuna = nameLower.includes('tuna');
                const isColdDrink = (cat.includes('drink') || cat.includes('beverage')) && !isTuna;
                const isHot = !isColdDrink && !isTuna && (
                  cat.includes('platter') || cat.includes('gyro') || cat.includes('sandwich') ||
                  cat.includes('burger') || cat.includes('berger') || cat.includes('grill') ||
                  nameLower.includes('hot') || nameLower.includes('grill') || nameLower.includes('shawarma')
                );

                const isFav = favoriteIds.has(item.id);
                return (
                  <div key={item.id} className={`menu-card${isHot?' menu-card--hot':''}${isColdDrink?' menu-card--cold':''}`} onClick={() => handleCardClick(item)} style={{ cursor: 'pointer' }}>
                    <div className="menu-card-img-wrap">
                      {isHot && (
                        <div className="menu-card-smoke" aria-hidden="true">
                          <span className="smoke-particle s1"/>
                          <span className="smoke-particle s2"/>
                          <span className="smoke-particle s3"/>
                        </div>
                      )}
                      {isColdDrink && (
                        <div className="menu-card-ice" aria-hidden="true">
                          <span className="ice-crystal i1">❄</span>
                          <span className="ice-crystal i2">❄</span>
                          <span className="ice-crystal i3">❄</span>
                        </div>
                      )}
                      <img
                        src={toWebp(imgSrc)}
                        alt={name}
                        className="menu-card-img"
                        loading="lazy"
                        decoding="async"
                        onError={e => {
                          e.target.onerror = () => { e.target.src = getFoodPhoto(item.id, idx + 13); };
                          e.target.src = imgSrc;
                        }}
                      />
                      {item.category && (
                        <span className="menu-card-category">
                          {(item.category || '').toLowerCase().includes('berger')
                            ? 'Burgers'
                            : (item.category || '').toLowerCase().includes('breakfast')
                            ? 'Breakfast'
                            : item.category}
                        </span>
                      )}
                      {isLoggedIn && (
                        <button
                          className={`menu-fav-btn${isFav ? ' active' : ''}`}
                          onClick={e => toggleFavorite(e, item.id)}
                          title={isFav ? 'Remove from favorites' : 'Save to favorites'}
                          aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
                        >
                          <Heart size={15} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                      )}
                    </div>
                    <div className="menu-card-body">
                      <div className="menu-card-top">
                        <h3 className="menu-card-name">{name}</h3>
                      </div>
                      {item.description && (
                        <p className="menu-card-desc">{item.description}</p>
                      )}
                      <div className="menu-card-footer">
                        <div className="diet-tags">
                          {(item.dietary_info || []).map(tag => (
                            <span key={tag} className="diet-tag">{tag}</span>
                          ))}
                        </div>
                        <span className="menu-card-price">${price.toFixed(2)}</span>
                        {(() => {
                          const cartItem = cartItems.find(ci => ci.id === item.id);
                          if (cartItem) {
                            return (
                              <div className="qty-stepper" onClick={e => e.stopPropagation()}>
                                <button className="qty-stepper-btn" onClick={() => updateQty(item.id, cartItem.qty - 1)}>
                                  <Minus size={11} />
                                </button>
                                <span className="qty-stepper-val">{cartItem.qty}</span>
                                <button className="qty-stepper-btn" onClick={() => updateQty(item.id, cartItem.qty + 1)}>
                                  <Plus size={11} />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              className={`add-btn${isAdded ? ' added' : ''}`}
                              onClick={e => { e.stopPropagation(); handleCardClick(item); }}
                            >
                              {isAdded ? '✓' : <><span className="btn-plus">+</span><span className="btn-add-text"> Add</span></>}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Sticky cart history strip */}
      {cartItems.length > 0 && (
        <div className="menu-cart-strip">
          <div className="menu-cart-strip-left">
            <ShoppingBag size={16} className="menu-cart-strip-icon" />
            <div className="menu-cart-strip-items">
              {cartItems.slice(0, 3).map(ci => (
                <span key={ci.id} className="menu-cart-strip-item">
                  <strong>{ci.qty}×</strong> {ci.name}
                </span>
              ))}
              {cartItems.length > 3 && (
                <span className="menu-cart-strip-more">+{cartItems.length - 3} more</span>
              )}
            </div>
          </div>
          <Link to="/checkout" className="menu-cart-strip-btn">
            View Cart · ${subtotal.toFixed(2)}
          </Link>
        </div>
      )}

      {/* Build Your Own wizard */}
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

      {/* Delivery Partners Section */}
      <div className="menu-delivery-partners">
        <h3>Also Available On</h3>
        <div className="partner-logos">
          <div className="partner-logo">DoorDash</div>
          <div className="partner-logo">Uber Eats</div>
          <div className="partner-logo">Grubhub</div>
          <div className="partner-logo caviar">Caviar</div>
        </div>
      </div>
    </div>
  );
};

export default Menu;
