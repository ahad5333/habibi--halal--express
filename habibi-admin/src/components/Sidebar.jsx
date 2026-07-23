import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Utensils, Users, Tag,
  BarChart2, Settings, LogOut, Zap, CreditCard,
  UserCheck, Package, MapPin, Truck, FileText, Monitor, Bell, Navigation,
  CalendarDays, Star, Shield, X, Briefcase, Clock,
  MessageSquare, Gift, BookOpen, DollarSign,
  AlertTriangle, Store, Handshake, Link2, KeyRound, Route,
  Bookmark, Share2, Users2, Layers,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import './Sidebar.css';

const NAV = [
  { to: '/',           icon: <LayoutDashboard size={17} />, label: 'Dashboard' },
  { to: '/orders',     icon: <ShoppingBag size={17} />,     label: 'Orders',          badge: 'live' },
  { to: '/urgent',     icon: <AlertTriangle size={17} />,   label: 'Urgent Requests' },
  { to: '/liveboard',  icon: <Monitor size={17} />,         label: 'Live Board',      badge: 'live' },
  { to: '/catering',      icon: <CalendarDays size={17} />, label: 'Catering Quotes' },
  { to: '/menu',           icon: <Utensils size={17} />,    label: 'Menu Builder' },
  { to: '/byo-ingredients', icon: <Layers size={17} />,     label: 'Build Your Own' },
  { to: '/global-addons',  icon: <Package size={17} />,    label: 'Global Add-ons' },
  { to: '/articles',       icon: <BookOpen size={17} />,   label: 'Articles' },
  { to: '/customers',  icon: <Users size={17} />,           label: 'Customers' },
  { to: '/partners',        icon: <Handshake size={17} />,  label: 'Partners' },
  { to: '/partner-orders',  icon: <Store size={17} />,      label: 'Partner Orders' },
  { to: '/wholesale-catalog', icon: <BookOpen size={17} />, label: 'Wholesale Catalog' },
  { to: '/staff',      icon: <UserCheck size={17} />,       label: 'Staff' },
  { to: '/careers',   icon: <Briefcase size={17} />,       label: 'Careers' },
  { to: '/reviews',   icon: <Star size={17} />,            label: 'Reviews' },
  { to: '/inventory',  icon: <Package size={17} />,         label: 'Inventory' },
  { to: '/locations',  icon: <MapPin size={17} />,          label: 'Locations' },
  { to: '/zones',      icon: <Truck size={17} />,           label: 'Delivery Zones' },
  { to: '/dispatch',          icon: <Navigation size={17} />, label: 'Dispatch',          badge: 'live' },
  { to: '/drivers',           icon: <Truck size={17} />,     label: 'Drivers' },
  { to: '/marketplace-orders', icon: <Store size={17} />,   label: 'Marketplace Orders' },
  { to: '/roadie',            icon: <Route size={17} />,     label: 'Roadie Deliveries' },
  { to: '/cash-log',   icon: <DollarSign size={17} />,     label: 'Cash Log' },
  { to: '/coupons',      icon: <Tag size={17} />,           label: 'Coupons & Offers' },
  { to: '/referrals',    icon: <Share2 size={17} />,        label: 'Referral Program' },
  { to: '/group-orders', icon: <Users2 size={17} />,        label: 'Group Orders' },
  { to: '/saved-customs',icon: <Bookmark size={17} />,      label: 'Saved Custom Orders' },
  { to: '/analytics',  icon: <BarChart2 size={17} />,       label: 'Analytics' },
  { to: '/reports',    icon: <FileText size={17} />,        label: 'Reports' },
  { to: '/payments',        icon: <CreditCard size={17} />, label: 'Payments' },
  { to: '/payment-accounts',   icon: <CreditCard size={17} />, label: 'Payment Accounts' },
  { to: '/platform-credentials', icon: <KeyRound size={17} />, label: 'API Credentials' },
  { to: '/broadcasts', icon: <Bell size={17} />,            label: 'Broadcasts' },
  { to: '/chat',       icon: <MessageSquare size={17} />,   label: 'Customer Chat', live: true },
  { to: '/loyalty',    icon: <Gift size={17} />,            label: 'Loyalty Program' },
  { to: '/audit-log',    icon: <Shield size={17} />,  label: 'Audit Log' },
  { to: '/integrations', icon: <Link2 size={17} />,   label: 'Integrations' },
  { to: '/settings',     icon: <Settings size={17} />, label: 'Settings' },
  { to: '/business-hours', icon: <Clock size={17} />,           label: 'Business Hours' },
];

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
  const pending = usePendingCount();

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

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${item.urgent ? 'urgent' : ''}`
            }
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-label">{item.label}</span>
            {item.to === '/orders' && pending > 0
              ? <span className="sidebar-count-badge">{pending > 99 ? '99+' : pending}</span>
              : item.badge === 'live' && <span className="sidebar-live-dot" />}
          </NavLink>
        ))}
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
