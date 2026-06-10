import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ExternalLink, Menu } from 'lucide-react';
import './TopBar.css';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

const TITLES = {
  '/':               { label: 'Dashboard',            sub: 'Overview & live stats' },
  '/orders':         { label: 'Orders',               sub: 'Manage incoming orders' },
  '/menu':           { label: 'Menu Builder',         sub: 'Add, edit, delete menu items' },
  '/customers':      { label: 'Customers',            sub: 'Browse and manage accounts' },
  '/coupons':        { label: 'Coupons',              sub: 'Promo codes & discounts' },
  '/partners':       { label: 'Partner Applications', sub: 'Review wholesale & partner requests' },
  '/wholesale-catalog': { label: 'Wholesale Catalog', sub: 'Business menu management' },
  '/partner-orders': { label: 'Partner Orders',       sub: 'B2B order management' },
  '/tables':         { label: 'Table Manager',        sub: 'Dine-in QR codes & seating' },
  '/catering':       { label: 'Catering',             sub: 'Event & catering requests' },
  '/careers':        { label: 'Careers',              sub: 'Job listings & applications' },
  '/reviews':        { label: 'Reviews',              sub: 'Customer ratings & feedback' },
  '/analytics':      { label: 'Analytics',            sub: 'Revenue, growth & reports' },
  '/payments':       { label: 'Payments',             sub: 'Transactions & refunds' },
  '/urgent':         { label: 'Urgent Requests',      sub: 'Active alerts from customers' },
  '/settings':       { label: 'Settings',             sub: 'System configuration' },
  '/staff':          { label: 'Staff',                sub: 'Team members & roles' },
  '/inventory':      { label: 'Inventory',            sub: 'Stock levels & alerts' },
  '/locations':      { label: 'Locations',            sub: 'Branch management' },
  '/zones':          { label: 'Delivery Zones',       sub: 'Coverage areas & fees' },
  '/reports':        { label: 'Reports',              sub: 'Financial & operational reports' },
  '/liveboard':      { label: 'Live Board',           sub: 'Real-time order display' },
  '/broadcasts':     { label: 'Broadcasts',           sub: 'Push & email campaigns' },
  '/dispatch':       { label: 'Delivery Dispatch',    sub: 'Driver assignment & tracking' },
  '/marketplace':    { label: 'Marketplace Orders',   sub: 'UberEats, GrubHub & DoorDash' },
  '/integrations':   { label: 'Integrations',        sub: 'Third-party platform connections' },
  '/credentials':    { label: 'Platform Credentials', sub: 'API keys & secrets' },
  '/driver':         { label: 'Driver View',          sub: 'Active delivery tracking' },
};

export default function TopBar({ onMenuToggle }) {
  const { pathname } = useLocation();
  const info = TITLES[pathname] || { label: 'Admin', sub: '' };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-hamburger" onClick={onMenuToggle} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <h1 className="topbar-title">{info.label}</h1>
        {info.sub && <p className="topbar-sub">{info.sub}</p>}
      </div>
      <div className="topbar-right">
        <a href={FRONTEND_URL} target="_blank" rel="noopener noreferrer" className="topbar-site-link">
          <ExternalLink size={14} /> View Site
        </a>
        <button className="topbar-bell" aria-label="Notifications">
          <Bell size={16} />
          <span className="topbar-bell-dot" />
        </button>
      </div>
    </header>
  );
}
