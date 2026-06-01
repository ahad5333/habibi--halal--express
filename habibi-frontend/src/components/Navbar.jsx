import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, Menu as MenuIcon, X, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { notificationsAPI } from '../services/api';
import './Navbar.css';

const LEFT_ITEMS = [
  {
    id: 'menu',
    label: 'Menu',
    path: '/menu',
    panel: { bg: 'linear-gradient(160deg,#eff6ff 0%,#bfdbfe 100%)', emoji: '🍽️', caption: 'Fresh & Flavorful' },
    sub: [
      { label: 'Breakfast', path: '/menu?cat=breakfast' },
      { label: 'Platter', path: '/menu?cat=platter' },
      { label: 'Sandwich', path: '/menu?cat=sandwich' },
      { label: 'Tacos', path: '/menu?cat=tacos' },
      { label: 'Build Your Own', path: '/menu?cat=build-your-own' },
      { label: 'Extras', path: '/menu?cat=extras' },
    ],
  },
  {
    id: 'about',
    label: 'About',
    path: '/about',
    panel: { bg: 'linear-gradient(160deg,#fef2f2 0%,#fecaca 100%)', emoji: '⭐', caption: 'Our Story & Values' },
    sub: [
      { label: 'Why Us?', path: '/about' },
      { label: 'Facebook', path: 'https://facebook.com/habibihalalexpress', external: true, icon: '📘' },
      { label: 'Instagram', path: 'https://instagram.com/habibihalalexpress', external: true, icon: '📸' },
      { label: 'YouTube', path: 'https://youtube.com/habibihalalexpress', external: true, icon: '▶️' },
      { label: 'TikTok', path: 'https://tiktok.com/@habibihalalexpress', external: true, icon: '🎵' },
    ],
  },
  {
    id: 'videos',
    label: 'Videos',
    path: '/videos',
    panel: { bg: 'linear-gradient(160deg,#f8fafc 0%,#e2e8f0 100%)', emoji: '🎬', caption: 'Watch Us in Action' },
    sub: [
      { label: 'Kitchen Behind the Scenes', path: '/videos' },
      { label: 'Customer Stories', path: '/videos' },
      { label: 'Our Journey', path: '/videos' },
    ],
  },
  {
    id: 'locations',
    label: 'Locations',
    path: '/locations',
    panel: { bg: 'linear-gradient(160deg,#faf5ff 0%,#e9d5ff 100%)', emoji: '📍', caption: 'Find Your Nearest Location' },
    sub: [
      { label: 'Bedford Park & Jerome Ave', path: '/locations#bedford' },
      { label: 'Lehman College Area', path: '/locations#lehman' },
      { label: 'Bronx Science Area', path: '/locations#bronx-science' },
    ],
  },
];

const CENTER_ITEM = {
  id: 'order',
  label: 'Order Online',
  path: '/order',
  panel: { bg: 'linear-gradient(160deg,#fef2f2 0%,#fca5a5 100%)', emoji: '🛵', caption: 'Super Express Delivery\nFriendly Online Tracking' },
  sub: [
    { label: 'Express Delivery', path: '/order?type=delivery' },
    { label: 'Pickup Order', path: '/order?type=pickup' },
    { label: 'Catering & Events 🍽️', path: '/catering' },
    { label: 'Where Can You Deliver?', path: '/locations#coverage' },
  ],
};

const RIGHT_ITEMS = [
  {
    id: 'urgent',
    label: 'Urgent Request',
    path: '/urgent',
    panel: { bg: 'linear-gradient(160deg,#fef2f2 0%,#fecaca 100%)', emoji: '🚨', caption: 'We Are Here for You 24/7' },
    sub: [
      { label: 'Urgent Help with an Existing Order', path: '/urgent?type=order' },
      { label: 'Question About an Item', path: '/urgent?type=item' },
      { label: 'Get an Urgent Call Back', path: '/urgent?type=callback' },
      { label: 'File an Order Related Complaint', path: '/urgent?type=complaint' },
      { label: 'Make Urgent Recommendation', path: '/urgent?type=recommend' },
    ],
  },
  {
    id: 'payment',
    label: 'Just Make a Payment',
    path: '/payment',
    panel: { bg: 'linear-gradient(160deg,#f0fdf4 0%,#bbf7d0 100%)', emoji: '💳', caption: 'Fast & Secure Payments' },
    sub: [
      { label: 'Quick Pay', path: '/payment?type=quick' },
      { label: 'Pay My Balance', path: '/payment?type=balance' },
      { label: 'Manage Payment Methods', path: '/payment?type=manage' },
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    path: '/staff',
    panel: { bg: 'linear-gradient(160deg,#fffbeb 0%,#fde68a 100%)', emoji: '👨‍🍳', caption: 'Meet Our Amazing Team' },
    sub: [
      { label: 'Management Staff', path: '/staff#management' },
      { label: 'Kitchen Staff', path: '/staff#kitchen' },
      { label: 'Serving Staff', path: '/staff#serving' },
      { label: 'Delivery Staff', path: '/staff#delivery' },
      { label: 'Stock Staff', path: '/staff#stock' },
      { label: 'We Are Hiring! 🌟', path: '/staff#hiring', highlight: true },
    ],
  },
  {
    id: 'contact',
    label: 'Contact Us',
    path: '/contact',
    panel: { bg: 'linear-gradient(160deg,#eff6ff 0%,#bfdbfe 100%)', emoji: '📬', caption: 'We Love Hearing from You' },
    sub: [
      { label: 'Make a Suggestion!', path: '/contact?type=suggestion' },
      { label: 'Tell Us Your Comments!', path: '/contact?type=comment' },
      { label: 'Submit Your Review!', path: '/contact?type=review' },
      { label: 'File a Complaint!', path: '/contact?type=complaint' },
      { label: 'Request a Manager Call!', path: '/contact?type=manager' },
      { label: 'Become a Partner!', path: '/contact?type=partner' },
      { label: 'For Media Contact!', path: '/contact?type=media' },
      { label: 'Email Us!', path: '/contact?type=email' },
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
                className={`nav-dropdown-link${s.highlight ? ' highlight' : ''}`}
              >
                {s.label}
              </Link>
            )
          )}
        </div>
        <div className="nav-dropdown-image-wrap">
          <img src={`/images/nav/${item.id}.png`} alt={item.label} className="nav-dropdown-img" />
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
  const { user, logout, isLoggedIn } = useAuth();
  const { totalItems } = useCart();
  const [openId, setOpenId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) { setUnreadCount(0); return; }
    const fetch = () =>
      notificationsAPI.getAll()
        .then(ns => setUnreadCount(Array.isArray(ns) ? ns.filter(n => !n.read).length : 0))
        .catch(() => {});
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

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
        <div className="navbar-top-inner">
          <Link to="/" className="navbar-logo">
            <img
              src="/images/logos/logo.png"
              alt="Habibi Halal Express"
              className="logo-img"
            />
            <div className="logo-text">
              <span className="logo-name-habibi">HABIBI</span>
              <span className="logo-rule">
                <span className="logo-rule-line" />
                <span className="logo-rule-gem">✦</span>
                <span className="logo-rule-line" />
              </span>
              <span className="logo-name-express">HALAL EXPRESS</span>
            </div>
          </Link>

          <div className="navbar-top-right">
            {isLoggedIn && (
              <Link to="/account?tab=notifications" className="cart-btn-wrap" title="Notifications" aria-label="Notifications">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="cart-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </Link>
            )}
            <Link to="/checkout" className="cart-btn-wrap" title="View Cart">
              <ShoppingBag size={20} />
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
                    <span className="user-greeting-hi">Hi,</span>
                    <strong>{user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Friend'}</strong>
                  </span>
                  <ChevronDown size={11} />
                </button>
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <p className="user-dropdown-name">{user?.name || 'Account'}</p>
                    <p className="user-dropdown-email">{user?.email || ''}</p>
                  </div>
                  <Link to="/order-tracking">My Orders</Link>
                  <Link to="/account">My Account</Link>
                  <button onClick={handleLogout} className="logout-item">
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-btns">
                <Link to="/login" className="btn-nav-login">Login</Link>
                <Link to="/signup" className="btn-nav-signup">Sign Up Free</Link>
              </div>
            )}

            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <MenuIcon size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main nav row ── */}
      <nav className="navbar-main" onMouseLeave={() => setOpenId(null)}>
        <div className="navbar-main-inner">
          {/* Left group */}
          <div className="nav-group">
            {LEFT_ITEMS.map((item) => (
              <NavItem key={item.id} item={item} openId={openId} setOpenId={setOpenId} />
            ))}
          </div>

          {/* Center: Order Online */}
          <div
            className={`nav-item nav-order-online${openId === CENTER_ITEM.id ? ' open' : ''}`}
            onMouseEnter={() => setOpenId(CENTER_ITEM.id)}
            onMouseLeave={() => setOpenId(null)}
          >
            <Link to={CENTER_ITEM.path} className="nav-order-label">
              🍽️ ORDER EXPRESS
            </Link>
            {openId === CENTER_ITEM.id && <DropdownPanel item={CENTER_ITEM} />}
          </div>

          {/* Right group */}
          <div className="nav-group">
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
                        className={`mobile-sub-link${s.highlight ? ' highlight' : ''}`}
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
                Sign Out
              </button>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setMobileOpen(false)}>
                  Login
                </Link>
                <Link to="/signup" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setMobileOpen(false)}>
                  Sign Up
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
