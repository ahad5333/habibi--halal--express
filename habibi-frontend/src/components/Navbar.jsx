import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, Menu as MenuIcon, X, ChevronDown, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { notificationsAPI } from '../services/api';
import './Navbar.css';

// Built as functions (not module-level constants) so labels/captions can
// pull from the active i18n language -- path/id/highlight/icon metadata
// stays hardcoded, it's not translatable content.
const buildLeftItems = (t) => [
  {
    id: 'menu',
    label: t('nav.left.menu.label'),
    path: '/menu',
    panel: { bg: 'linear-gradient(160deg,#eff6ff 0%,#bfdbfe 100%)', emoji: '🍽️', caption: t('nav.left.menu.caption') },
    sub: [
      { label: t('nav.left.menu.sub.breakfast'), path: '/menu/breakfast' },
      { label: t('nav.left.menu.sub.platter'),   path: '/menu/platter' },
      { label: t('nav.left.menu.sub.sandwich'),  path: '/menu/sandwich' },
      { label: t('nav.left.menu.sub.burgers'),   path: '/menu/burgers' },
      { label: t('nav.left.menu.sub.tacos'),     path: '/menu/tacos' },
      { label: t('nav.left.menu.sub.specials'),  path: '/menu/specials' },
      { label: t('nav.left.menu.sub.extras'),    path: '/menu/extras' },
      { label: t('nav.left.menu.sub.drinks'),    path: '/menu/drinks' },
      { label: t('nav.left.menu.sub.family'),    path: '/menu/family' },
      { label: t('nav.left.menu.sub.byo'),       path: '/menu/byo' },
    ],
  },
  {
    id: 'about',
    label: t('nav.left.about.label'),
    path: '/about',
    panel: { bg: 'linear-gradient(160deg,#fef2f2 0%,#fecaca 100%)', emoji: '⭐', caption: t('nav.left.about.caption') },
    sub: [
      { label: t('nav.left.about.sub.why'), path: '/about' },
      { label: t('nav.left.about.sub.reviews'), path: '/reviews' },
      { label: t('nav.left.about.sub.facebook'), path: 'https://facebook.com/habibihalalexpress', external: true, icon: '📘' },
      { label: t('nav.left.about.sub.instagram'), path: 'https://instagram.com/habibihalalexpress', external: true, icon: '📸' },
      { label: t('nav.left.about.sub.youtube'), path: 'https://youtube.com/habibihalalexpress', external: true, icon: '▶️' },
      { label: t('nav.left.about.sub.tiktok'), path: 'https://tiktok.com/@habibihalalexpress', external: true, icon: '🎵' },
    ],
  },
  {
    id: 'articles',
    label: t('nav.left.articles.label'),
    path: '/articles',
    panel: { bg: 'linear-gradient(160deg,#1a0a00 0%,#2d1500 100%)', emoji: '✍️', caption: t('nav.left.articles.caption') },
    sub: [
      { label: t('nav.left.articles.sub.kitchen'), path: '/kitchen-behind-the-scenes' },
      { label: t('nav.left.articles.sub.stories'), path: '/customer-stories' },
      { label: t('nav.left.articles.sub.journey'), path: '/our-journey' },
      { label: t('nav.left.articles.sub.tacosArticle'), path: '/articles/habibi-tacos' },
      { label: t('nav.left.articles.sub.videos'), path: '/videos' },
    ],
  },
  {
    id: 'locations',
    label: t('nav.left.locations.label'),
    path: '/locations',
    panel: { bg: 'linear-gradient(160deg,#faf5ff 0%,#e9d5ff 100%)', emoji: '📍', caption: t('nav.left.locations.caption') },
    sub: [
      { label: t('nav.left.locations.sub.bedford'), path: '/locations#bedford' },
      { label: t('nav.left.locations.sub.kingsbridge'), path: '/locations#kingsbridge' },
      { label: t('nav.left.locations.sub.whitePlains'), path: '/locations#white-plains' },
    ],
  },
];

const buildCenterItem = (t) => ({
  id: 'order',
  label: t('nav.center.order.label'),
  path: '/order',
  panel: { bg: 'linear-gradient(160deg,#fef2f2 0%,#fca5a5 100%)', emoji: '🛵', caption: t('nav.center.order.caption') },
  sub: [
    { label: t('nav.center.order.sub.delivery'), path: '/order?type=delivery' },
    { label: t('nav.center.order.sub.pickup'),   path: '/order?type=pickup' },
    { label: t('nav.center.order.sub.group'),    path: '/group-order',      highlight: true },
    { label: t('nav.center.order.sub.offers'),   path: '/offers',           highlight: true },
    { label: t('nav.center.order.sub.gift'),     path: '/checkout?gift=true', highlight: true },
    { label: t('nav.center.order.sub.catering'), path: '/catering' },
    { label: t('nav.center.order.sub.coverage'), path: '/delivery-coverage' },
  ],
});

const buildRightItems = (t) => [
  {
    id: 'payment',
    label: t('nav.right.payment.label'),
    path: '/payment',
    panel: { bg: 'linear-gradient(160deg,#f0fdf4 0%,#bbf7d0 100%)', emoji: '💳', caption: t('nav.right.payment.caption') },
    sub: [
      { label: t('nav.right.payment.sub.quickPay'), path: '/payment' },
      { label: t('nav.right.payment.sub.balance'), path: '/payment?type=balance' },
      { label: t('nav.right.payment.sub.manage'), path: '/payment?type=manage' },
    ],
  },
  {
    id: 'staff',
    label: t('nav.right.staff.label'),
    path: '/staff',
    panel: { bg: 'linear-gradient(160deg,#fffbeb 0%,#fde68a 100%)', emoji: '👨‍🍳', caption: t('nav.right.staff.caption') },
    sub: [
      { label: t('nav.right.staff.sub.management'), path: '/staff#management' },
      { label: t('nav.right.staff.sub.kitchen'),    path: '/staff#kitchen' },
      { label: t('nav.right.staff.sub.serving'),    path: '/staff#serving' },
      { label: t('nav.right.staff.sub.delivery'),   path: '/staff#delivery' },
      { label: t('nav.right.staff.sub.stock'),      path: '/staff#stock' },
      { label: t('nav.right.staff.sub.hiring'), path: '/careers' },
    ],
  },
  {
    id: 'contact',
    label: t('nav.right.contact.label'),
    path: '/contact',
    panel: { bg: 'linear-gradient(160deg,#eff6ff 0%,#bfdbfe 100%)', emoji: '📬', caption: t('nav.right.contact.caption') },
    sub: [
      { label: t('nav.right.contact.sub.getInTouch'), path: '/contact', highlight: true },
      { label: t('nav.right.contact.sub.urgent'), path: '/urgent', highlight: true },
      { label: t('nav.right.contact.sub.suggestion'), path: '/contact?type=suggestion' },
      { label: t('nav.right.contact.sub.comment'), path: '/contact?type=comment' },
      { label: t('nav.right.contact.sub.review'), path: '/contact?type=review' },
      { label: t('nav.right.contact.sub.complaint'), path: '/contact?type=complaint' },
      { label: t('nav.right.contact.sub.partner'), path: '/contact?type=partner' },
      { label: t('nav.right.contact.sub.media'), path: '/contact?type=media' },
      { label: t('nav.right.contact.sub.email'), path: '/contact?type=email' },
    ],
  },
];

function DropdownPanel({ item }) {
  return (
    <div className="nav-dropdown" role="menu">
      {/* invisible bridge to prevent hover gap */}
      <div className="nav-dropdown-bridge" />
      <div className="nav-dropdown-inner">
        <div className="nav-dropdown-links">
          <p className="nav-dropdown-title">{item.label}</p>
          {item.sub.map((s) =>
            s.external ? (
              <a
                key={s.label}
                href={s.path}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-dropdown-link"
              >
                {s.icon && <span className="sub-icon">{s.icon}</span>}
                {s.label}
              </a>
            ) : (
              <Link
                key={s.label}
                to={s.path}
                className={`nav-dropdown-link${s.highlight ? ' highlight' : ''}${s.featured ? ' featured' : ''}`}
              >
                {s.label}
              </Link>
            )
          )}
        </div>
        <div className="nav-dropdown-image-wrap">
          <img src={`/images/nav/${item.id}.webp`} alt={item.label} className="nav-dropdown-img" />
          <div className="nav-dropdown-caption-overlay">
            <p>{item.panel.caption}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ item, openId, setOpenId }) {
  return (
    <div
      className={`nav-item nav-item-${item.id}${openId === item.id ? ' open' : ''}`}
      onMouseEnter={() => setOpenId(item.id)}
      onMouseLeave={() => setOpenId(null)}
    >
      <Link to={item.path} className="nav-item-label">
        {item.label}
        <ChevronDown size={10} className="nav-chevron" />
      </Link>
      {openId === item.id && <DropdownPanel item={item} />}
    </div>
  );
}

const Navbar = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout, isLoggedIn } = useAuth();
  const { totalItems } = useCart();
  const [openId, setOpenId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);

  // Rebuilt whenever the language changes so every label/caption re-resolves.
  const LEFT_ITEMS   = useMemo(() => buildLeftItems(t),   [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const CENTER_ITEM  = useMemo(() => buildCenterItem(t),  [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const RIGHT_ITEMS  = useMemo(() => buildRightItems(t),  [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const bellRef = useRef(null);

  // The Halal badge (top row) and the Order Now badge (main nav row directly
  // below it) are meant to sit in the same vertical line -- but each row's
  // flanking content is a different width (logo vs. auth icon cluster up
  // top; 4 nav links vs. 3 nav links below), so centering each badge on its
  // own row's gap independently produces two different x-positions even
  // though both rows share the same max-width+margin:auto container. Fixed
  // by computing ONE shared `left` (anchored to the Halal badge's ideal gap
  // center, since that's the more prominent landmark) and applying that same
  // px value to both badges, clamped to whichever row's neighbors are
  // currently tightest so it can never overlap either row's content.
  const topInnerRef = useRef(null);
  const logoRef = useRef(null);
  const centerBadgesRef = useRef(null);
  const topRightRef = useRef(null);
  const navMainInnerRef = useRef(null);
  const navLeftGroupRef = useRef(null);
  const navOrderOnlineRef = useRef(null);
  const navRightGroupRef = useRef(null);
  useLayoutEffect(() => {
    const topContainer = topInnerRef.current;
    const logo = logoRef.current;
    const badges = centerBadgesRef.current;
    const topRight = topRightRef.current;
    const navContainer = navMainInnerRef.current;
    const navLeft = navLeftGroupRef.current;
    const navOrder = navOrderOnlineRef.current;
    const navRight = navRightGroupRef.current;
    if (!topContainer || !logo || !badges || !topRight || !navContainer || !navLeft || !navOrder || !navRight) return;

    const GAP = 8; // minimum breathing room between a badge and its row neighbors, px

    const reposition = () => {
      // `left` on an absolutely positioned child is measured from the
      // container's padding box, but offsetWidth-based math assumes the
      // flex children sit flush against that same edge -- they don't, both
      // rows have real left/right padding, so getBoundingClientRect() keeps
      // everything in one consistent, padding-agnostic coordinate space.
      const topContainerRect = topContainer.getBoundingClientRect();
      const logoRect = logo.getBoundingClientRect();
      const topRightRect = topRight.getBoundingClientRect();
      const badgeWidth = badges.offsetWidth;

      const navContainerRect = navContainer.getBoundingClientRect();
      const navLeftRect = navLeft.getBoundingClientRect();
      const navRightRect = navRight.getBoundingClientRect();
      const orderWidth = navOrder.offsetWidth;

      const sharedTarget = ((logoRect.right + topRightRect.left) / 2) - topContainerRect.left;

      const minLeftTop = (logoRect.right - topContainerRect.left) + GAP + badgeWidth / 2;
      const maxLeftTop = (topRightRect.left - topContainerRect.left) - GAP - badgeWidth / 2;
      const minLeftBottom = (navLeftRect.right - navContainerRect.left) + GAP + orderWidth / 2;
      const maxLeftBottom = (navRightRect.left - navContainerRect.left) - GAP - orderWidth / 2;

      // Intersection of both rows' valid ranges -- the shared position must
      // avoid overlapping whichever row's content is currently tightest.
      const minLeft = Math.max(minLeftTop, minLeftBottom);
      const maxLeft = Math.min(maxLeftTop, maxLeftBottom);

      const left = maxLeft < minLeft
        ? sharedTarget // no room to avoid overlap on one row or the other -- still the best-effort shared center
        : Math.min(Math.max(sharedTarget, minLeft), maxLeft);

      badges.style.left = `${left}px`;
      navOrder.style.left = `${left}px`;
    };

    reposition();
    const ro = new ResizeObserver(reposition);
    ro.observe(topContainer);
    ro.observe(logo);
    ro.observe(topRight);
    ro.observe(badges);
    ro.observe(navContainer);
    ro.observe(navLeft);
    ro.observe(navRight);
    ro.observe(navOrder);
    return () => ro.disconnect();
  }, [isLoggedIn, unreadCount, totalItems]);

  useEffect(() => {
    if (!isLoggedIn) { setUnreadCount(0); return; }
    const load = () =>
      notificationsAPI.getAll()
        .then(ns => { if (Array.isArray(ns)) setUnreadCount(ns.filter(n => !n.read).length); })
        .catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  const openBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) {
      try {
        const ns = await notificationsAPI.getAll();
        if (Array.isArray(ns)) {
          setNotifications(ns.slice(0, 8));
          setUnreadCount(ns.filter(n => !n.read).length);
        }
      } catch (_) {}
    }
  };

  const markAllRead = async () => {
    await notificationsAPI.markAllRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileOpen(false);
  };

  const allItems = [...LEFT_ITEMS, CENTER_ITEM, ...RIGHT_ITEMS];

  return (
    <header className="navbar">
      {/* ── Top bar: logo + auth ── */}
      <div className="navbar-top">
        <div className="navbar-top-inner" ref={topInnerRef}>
          <Link to="/" className="navbar-logo" ref={logoRef}>
            <img
              src="/images/logos/logo-full.jpg"
              alt="Habibi Halal Express"
              className="logo-img"
            />
          </Link>

          {/* Center: Halal badge (desktop) / Order Now badge (mobile — see
              @media max-width:768px, which swaps which one is visible) */}
          <div className="navbar-center-badges" ref={centerBadgesRef}>
            <img
              src="/images/logos/halal-certified-nav.webp"
              alt={t('common.halalCertified')}
              className="navbar-halal-badge"
            />
            <Link to="/order" className="navbar-order-badge" title={t('common.orderNow')}>
              <img
                src="/images/logos/order-now-badge.webp"
                alt={t('common.orderNow')}
                className="navbar-order-badge-img"
              />
            </Link>
          </div>

          <div className="navbar-top-right" ref={topRightRef}>
            {isLoggedIn && (
              <div className="notif-wrap" ref={bellRef}>
                <button className="cart-btn-wrap notif-bell-btn" onClick={openBell} aria-label={t('common.notifications')}>
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="cart-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </button>

                {bellOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-dropdown-hd">
                      <span className="notif-dropdown-title">{t('common.notifications')}</span>
                      {unreadCount > 0 && (
                        <button className="notif-mark-all" onClick={markAllRead}>{t('common.markAllRead')}</button>
                      )}
                    </div>

                    {notifications.length === 0 ? (
                      <p className="notif-empty">{t('common.noNotifications')}</p>
                    ) : (
                      <div className="notif-list">
                        {notifications.map(n => (
                          <div
                            key={n.id}
                            className={`notif-item${n.read ? '' : ' unread'}`}
                            onClick={() => {
                              notificationsAPI.markRead(n.id).catch(() => {});
                              setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                              setUnreadCount(c => Math.max(0, c - (n.read ? 0 : 1)));
                            }}
                          >
                            {!n.read && <span className="notif-dot" />}
                            <div className="notif-item-body">
                              <p className="notif-item-title">{n.title}</p>
                              <p className="notif-item-text">{n.body}</p>
                              <p className="notif-item-time">{formatTime(n.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Link to="/account?tab=notifications" className="notif-footer" onClick={() => setBellOpen(false)}>
                      {t('common.viewAllNotifications')}
                    </Link>
                  </div>
                )}
              </div>
            )}
            <Link to="/customize" className="navbar-customize-btn" title={t('common.buildYourOwn')}>
              <img src="/images/byo/customize-icon.webp" alt={t('common.buildYourOwn')} className="navbar-customize-icon" />
              <span className="navbar-customize-label">
                <span className="cust-lbl-spark">✦</span>
                <span className="cust-lbl-text">{t('common.buildYourOwn')}</span>
                <span className="cust-lbl-spark">✦</span>
              </span>
            </Link>

            <Link to="/checkout" className="cart-btn-wrap" title={t('common.viewCart')}>
              <ShoppingBag size={24} />
              {totalItems > 0 && (
                <span className="cart-badge">{totalItems > 9 ? '9+' : totalItems}</span>
              )}
            </Link>

            {isLoggedIn ? (
              <div className="user-menu">
                <button className="user-btn">
                  <span className="user-avatar">
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="user-greeting">
                    <span className="user-greeting-hi">{t('common.hi')}</span>
                    <strong>{user?.name?.split(' ')[0] || user?.email?.split('@')[0] || t('common.friend')}</strong>
                  </span>
                  <ChevronDown size={11} />
                </button>
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <p className="user-dropdown-name">{user?.name || t('common.myAccount')}</p>
                    <p className="user-dropdown-email">{user?.email || ''}</p>
                  </div>
                  <Link to="/order-tracking">{t('common.myOrders')}</Link>
                  <Link to="/account">{t('common.myAccount')}</Link>
                  <button onClick={handleLogout} className="logout-item">
                    <LogOut size={13} /> {t('common.signOut')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-btns">
                <Link to="/login" className="btn-nav-login">{t('common.login')}</Link>
                <Link to="/signup" className="btn-nav-signup">{t('common.signUp')}</Link>
              </div>
            )}

            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={t('common.toggleMenu')}
            >
              {mobileOpen ? <X size={26} /> : <MenuIcon size={26} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main nav row ── */}
      <nav className="navbar-main" onMouseLeave={() => setOpenId(null)}>
        <div className="navbar-main-inner" ref={navMainInnerRef}>
          {/* Left group */}
          <div className="nav-group" ref={navLeftGroupRef}>
            {LEFT_ITEMS.map((item) => (
              <NavItem key={item.id} item={item} openId={openId} setOpenId={setOpenId} />
            ))}
          </div>

          {/* Center: Order Now — same row height/dropdown behavior as the
              other nav items, but the logo badge in place of plain text */}
          <div
            className={`nav-item nav-order-online${openId === CENTER_ITEM.id ? ' open' : ''}`}
            ref={navOrderOnlineRef}
            onMouseEnter={() => setOpenId(CENTER_ITEM.id)}
            onMouseLeave={() => setOpenId(null)}
          >
            <Link to={CENTER_ITEM.path} className="nav-item-label nav-order-label" title={t('common.orderNow')}>
              <span className="nav-order-logo-wrap">
                <img src="/images/logos/order-now-badge.webp" alt={t('common.orderNow')} className="nav-order-logo-img" />
              </span>
            </Link>
            {openId === CENTER_ITEM.id && <DropdownPanel item={CENTER_ITEM} />}
          </div>

          {/* Right group */}
          <div className="nav-group" ref={navRightGroupRef}>
            {RIGHT_ITEMS.map((item) => (
              <NavItem key={item.id} item={item} openId={openId} setOpenId={setOpenId} />
            ))}
          </div>
        </div>
      </nav>

      {/* ── Mobile slide-down menu ── */}
      {mobileOpen && (
        <div className="mobile-menu">
          {allItems.map((item) => (
            <div key={item.id} className="mobile-item">
              <button
                className="mobile-item-header"
                onClick={() =>
                  setMobileExpanded(mobileExpanded === item.id ? null : item.id)
                }
              >
                <span className={item.id === 'order' ? 'mobile-featured-label' : ''}>
                  {item.label}
                </span>
                <ChevronDown
                  size={14}
                  className={`mobile-chevron${mobileExpanded === item.id ? ' rotated' : ''}`}
                />
              </button>

              {mobileExpanded === item.id && (
                <div className="mobile-sub">
                  {item.sub.map((s) =>
                    s.external ? (
                      <a
                        key={s.label}
                        href={s.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mobile-sub-link"
                        onClick={() => setMobileOpen(false)}
                      >
                        {s.icon && <span>{s.icon} </span>}
                        {s.label}
                      </a>
                    ) : (
                      <Link
                        key={s.label}
                        to={s.path}
                        className={`mobile-sub-link${s.highlight ? ' highlight' : ''}${s.featured ? ' featured' : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        {s.label}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="mobile-auth-row">
            {isLoggedIn ? (
              <button onClick={handleLogout} className="btn btn-outline" style={{ width: '100%' }}>
                {t('common.signOut')}
              </button>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setMobileOpen(false)}>
                  {t('common.login')}
                </Link>
                <Link to="/signup" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setMobileOpen(false)}>
                  {t('common.signUp')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

    </header>
  );
};

export default Navbar;
