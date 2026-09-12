import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Utensils, Users, Tag,
  Settings, LogOut, Zap, CreditCard,
  UserCheck, Package, MapPin, Truck, FileText, Monitor, Bell, Navigation,
  CalendarDays, Star, Shield, X, Briefcase, Clock,
  MessageSquare, Gift, BookOpen, DollarSign,
  AlertTriangle, Store, Handshake, Link2, KeyRound, Route,
  Bookmark, Share2, Users2, Layers, LayoutGrid, RefreshCw, Bot, Trash2, CalendarClock,
  Search, ChevronDown, Map as MapIcon, Eye, EyeOff, RotateCcw,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import './Sidebar.css';

// Every page in the panel lives here, in one of eight groups.
//   adv: true  — a page that is built but not in daily use. Hidden until
//                "Show all pages" is switched on. Search still finds it.
//   kw         — extra words search should match, so "refund" finds Payments
//                and "promo" finds Coupons.
const HOME = { to: '/', icon: <LayoutDashboard size={17} />, label: 'Dashboard' };

const GROUPS = [
  {
    name: 'Orders',
    icon: <ShoppingBag size={13} />,
    items: [
      { to: '/all-orders',    icon: <LayoutGrid size={17} />,    label: 'All Orders',          kw: 'every channel combined unified' },
      { to: '/orders',        icon: <ShoppingBag size={17} />,   label: 'Orders',              badge: 'live', kw: 'website online new incoming' },
      { to: '/liveboard',     icon: <Monitor size={17} />,       label: 'Live Board',          badge: 'live', kw: 'kitchen screen queue' },
      { to: '/urgent',        icon: <AlertTriangle size={17} />, label: 'Urgent Requests',     urgent: true, kw: 'sos help emergency' },
      { to: '/catering',      icon: <CalendarDays size={17} />,  label: 'Catering Quotes',     kw: 'event party tray invoice' },
      { to: '/group-orders',  icon: <Users2 size={17} />,        label: 'Group Orders',        adv: true, kw: 'office shared split' },
      { to: '/saved-customs', icon: <Bookmark size={17} />,      label: 'Saved Custom Orders', adv: true, kw: 'build your own saved' },
      { to: '/subscriptions', icon: <RefreshCw size={17} />,     label: 'Subscriptions',       adv: true, kw: 'weekly recurring repeat' },
    ],
  },
  {
    name: 'Menu & Stock',
    icon: <Utensils size={13} />,
    items: [
      { to: '/menu',            icon: <Utensils size={17} />, label: 'Menu Builder',   kw: 'dishes prices items photos' },
      { to: '/byo-ingredients', icon: <Layers size={17} />,   label: 'Build Your Own', kw: 'byo ingredients custom' },
      { to: '/global-addons',   icon: <Package size={17} />,  label: 'Global Add-ons', kw: 'extras sides options' },
      { to: '/inventory',       icon: <Package size={17} />,  label: 'Inventory',      kw: 'stock sold out count' },
      { to: '/waste',           icon: <Trash2 size={17} />,   label: 'Waste Log',      kw: 'spoilage thrown away binned' },
    ],
  },
  {
    name: 'Delivery',
    icon: <Truck size={13} />,
    items: [
      { to: '/dispatch',            icon: <Navigation size={17} />, label: 'Dispatch',            badge: 'live', kw: 'assign driver send' },
      { to: '/drivers',             icon: <Truck size={17} />,      label: 'Drivers',             kw: 'couriers payroll ratings' },
      { to: '/locations',           icon: <MapPin size={17} />,     label: 'Locations',           kw: 'branches stores address phone' },
      { to: '/zones',               icon: <MapIcon size={17} />,    label: 'Delivery Zones',      adv: true, kw: 'radius area fee' },
      { to: '/roadie',              icon: <Route size={17} />,      label: 'Roadie Deliveries',   adv: true, kw: 'courier third party' },
      { to: '/marketplace-orders',  icon: <Store size={17} />,      label: 'Marketplace Orders',  adv: true, kw: 'ubereats grubhub doordash caviar' },
    ],
  },
  {
    name: 'People',
    icon: <Users size={13} />,
    items: [
      { to: '/customers', icon: <Users size={17} />,         label: 'Customers',      kw: 'guests accounts addresses' },
      { to: '/chat',      icon: <MessageSquare size={17} />, label: 'Customer Chat',  kw: 'messages support reply' },
      { to: '/reviews',   icon: <Star size={17} />,          label: 'Reviews',        kw: 'ratings feedback stars' },
      { to: '/staff',     icon: <UserCheck size={17} />,     label: 'Staff',          kw: 'employees pin login roles' },
      { to: '/schedule',  icon: <CalendarClock size={17} />, label: 'Staff Schedule', kw: 'shifts hours clock in time off' },
      { to: '/careers',   icon: <Briefcase size={17} />,     label: 'Careers',        adv: true, kw: 'jobs hiring applications cv' },
    ],
  },
  {
    name: 'Money',
    icon: <DollarSign size={13} />,
    items: [
      { to: '/payments',            icon: <CreditCard size={17} />, label: 'Payments',            kw: 'refund transactions charges paid square clover paypal zelle cash app processors accounts' },
      { to: '/refunds',             icon: <RotateCcw size={17} />,  label: 'Refunds',             kw: 'refunded money back returned chargeback' },
      { to: '/reports',             icon: <FileText size={17} />,   label: 'Reports',             kw: 'sales tax revenue profit margin forecast analytics growth daily chart new customers' },
      { to: '/cash-log',            icon: <DollarSign size={17} />, label: 'Cash Log',            adv: true, kw: 'driver hand in drawer' },
    ],
  },
  {
    name: 'Marketing',
    icon: <Tag size={13} />,
    items: [
      { to: '/coupons',    icon: <Tag size={17} />,      label: 'Coupons & Offers', kw: 'discount promo code freeship deal' },
      { to: '/loyalty',    icon: <Gift size={17} />,     label: 'Loyalty Program',  kw: 'points tiers rewards platinum' },
      { to: '/broadcasts', icon: <Bell size={17} />,     label: 'Broadcasts',       kw: 'sms email blast newsletter announce' },
      { to: '/articles',   icon: <BookOpen size={17} />, label: 'Articles',         kw: 'blog news posts' },
      { to: '/assistant',  icon: <Bot size={17} />,      label: 'AI Assistant',     kw: 'chatbot questions asked' },
      { to: '/gift-cards', icon: <Gift size={17} />,     label: 'Gift Cards',       adv: true, kw: 'vouchers balance' },
      { to: '/referrals',  icon: <Share2 size={17} />,   label: 'Referral Program', adv: true, kw: 'refer a friend invite' },
    ],
  },
  {
    name: 'Wholesale',
    icon: <Handshake size={13} />,
    items: [
      { to: '/partners',           icon: <Handshake size={17} />, label: 'Partners',           adv: true, kw: 'business b2b applications' },
      { to: '/partner-orders',     icon: <Store size={17} />,     label: 'Partner Orders',     adv: true, kw: 'b2b bulk business' },
      { to: '/wholesale-catalog',  icon: <BookOpen size={17} />,  label: 'Wholesale Catalog',  adv: true, kw: 'partner prices trade' },
    ],
  },
  {
    name: 'Setup',
    icon: <Settings size={13} />,
    items: [
      { to: '/settings',              icon: <Settings size={17} />, label: 'Settings',        kw: 'site config general' },
      { to: '/business-hours',        icon: <Clock size={17} />,    label: 'Business Hours',  kw: 'open close times holiday' },
      { to: '/audit-log',             icon: <Shield size={17} />,   label: 'Audit Log',       kw: 'who changed what history security' },
      { to: '/integrations',          icon: <Link2 size={17} />,    label: 'Integrations',    adv: true, kw: 'webhook connect' },
      { to: '/platform-credentials',  icon: <KeyRound size={17} />, label: 'API Credentials', adv: true, kw: 'keys tokens secrets' },
    ],
  },
];

const ADV_KEY      = 'habibi_admin_show_all_pages';
const COLLAPSE_KEY = 'habibi_admin_nav_collapsed';

const readLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
};
const writeLS = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const fetch_ = () =>
      fetch(`${BASE}/api/admin/stats`, { credentials: 'include', cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.pending != null) setCount(parseInt(d.pending)); })
        .catch(() => {});
    fetch_();
    const t = setInterval(fetch_, 30_000);
    return () => clearInterval(t);
  }, []);
  return count;
}

export default function Sidebar({ open, onClose }) {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pending = usePendingCount();

  const [showAll, setShowAll]     = useState(() => readLS(ADV_KEY, false));
  const [collapsed, setCollapsed] = useState(() => readLS(COLLAPSE_KEY, {}));
  const [query, setQuery]         = useState('');
  const [cursor, setCursor]       = useState(0);
  const searchRef = useRef(null);

  useEffect(() => { writeLS(ADV_KEY, showAll); }, [showAll]);
  useEffect(() => { writeLS(COLLAPSE_KEY, collapsed); }, [collapsed]);

  // Ctrl/Cmd+K from anywhere in the panel jumps to the page search.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Navigating into a group the user had collapsed re-opens it, so the sidebar
  // shows where you are. Deliberately skipped on first render: collapsing the
  // group you are already in should survive a reload.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const group = GROUPS.find(g => g.items.some(i => i.to === location.pathname));
    if (group && collapsed[group.name]) {
      setCollapsed(prev => ({ ...prev, [group.name]: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Search looks through every page, advanced ones included — hiding a page
  // should never make it unfindable.
  const results = useMemo(() => {
    const tokens = norm(query).split(' ').filter(Boolean);
    if (!tokens.length) return null;
    const out = [];
    for (const group of [{ name: 'Dashboard', items: [HOME] }, ...GROUPS]) {
      for (const item of group.items) {
        const hay = norm(`${item.label} ${item.kw || ''} ${group.name}`);
        if (tokens.every(t => hay.includes(t))) out.push({ ...item, group: group.name });
      }
    }
    return out;
  }, [query]);

  useEffect(() => { setCursor(0); }, [query]);

  const onSearchKey = (e) => {
    if (!results || !results.length) {
      if (e.key === 'Escape') setQuery('');
      return;
    }
    if (e.key === 'ArrowDown')      { e.preventDefault(); setCursor(c => (c + 1) % results.length); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => (c - 1 + results.length) % results.length); }
    else if (e.key === 'Enter')     { e.preventDefault(); go(results[cursor]?.to); }
    else if (e.key === 'Escape')    { setQuery(''); searchRef.current?.blur(); }
  };

  const go = (to) => {
    if (!to) return;
    setQuery('');
    navigate(to);
    onClose?.();
  };

  const toggleGroup = (name) => setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));

  const trailing = (item) => {
    if (item.to === '/orders' && pending > 0) {
      return <span className="sidebar-count-badge">{pending > 99 ? '99+' : pending}</span>;
    }
    return item.badge === 'live' ? <span className="sidebar-live-dot" /> : null;
  };

  const renderLink = (item, extraClass = '') => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      onClick={onClose}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'active' : ''} ${item.urgent ? 'urgent' : ''} ${extraClass}`
      }
    >
      <span className="sidebar-link-icon">{item.icon}</span>
      <span className="sidebar-link-label">{item.label}</span>
      {item.group ? <span className="sidebar-result-group">{item.group}</span> : trailing(item)}
    </NavLink>
  );

  // A page that is hidden by the toggle still shows while you are standing on it.
  const visible = (item) => showAll || !item.adv || item.to === location.pathname;
  const hiddenCount = GROUPS.reduce((n, g) => n + g.items.filter(i => i.adv).length, 0);

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><Zap size={16} /></div>
        <div>
          <p className="sidebar-brand-name">Habibi Admin</p>
          <p className="sidebar-brand-sub">CPanel v1.0</p>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <Search size={14} className="sidebar-search-icon" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Search pages"
          aria-label="Search pages"
          className="sidebar-search-input"
        />
        {query
          ? <button className="sidebar-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={12} /></button>
          : <kbd className="sidebar-search-kbd">Ctrl K</kbd>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {results ? (
          results.length ? (
            results.map((item, i) => renderLink(item, i === cursor ? 'kbd-active' : ''))
          ) : (
            <p className="sidebar-empty">No page matches “{query}”.</p>
          )
        ) : (
          <>
            {renderLink(HOME)}
            {GROUPS.map(group => {
              const items = group.items.filter(visible);
              if (!items.length) return null;
              const isCollapsed = !!collapsed[group.name];
              const holdsActive = items.some(i => i.to === location.pathname);
              return (
                <div className="sidebar-group" key={group.name}>
                  <button
                    className={`sidebar-group-head${isCollapsed ? ' collapsed' : ''}`}
                    onClick={() => toggleGroup(group.name)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="sidebar-group-icon">{group.icon}</span>
                    <span className="sidebar-group-label">{group.name}</span>
                    {isCollapsed && holdsActive && <span className="sidebar-group-dot" title="You are on a page in here" />}
                    <ChevronDown size={13} className="sidebar-group-chev" />
                  </button>
                  {!isCollapsed && items.map(item => renderLink(item))}
                </div>
              );
            })}

            <button className="sidebar-advtoggle" onClick={() => setShowAll(v => !v)}>
              {showAll ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showAll ? 'Hide extra pages' : `Show all pages (${hiddenCount} more)`}</span>
            </button>
          </>
        )}
      </nav>

      {/* User info */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{(admin?.name || 'A').charAt(0).toUpperCase()}</div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{admin?.name || 'Admin'}</p>
            <p className="sidebar-user-role">Administrator</p>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout} title="Sign out">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
