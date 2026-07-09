import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626' }}>Something went wrong</h2>
          <p style={{ color: '#64748b', marginTop: 8 }}>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '8px 20px', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

// Eagerly loaded — needed before auth resolves
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Lazy-loaded — split into separate chunks
const Orders           = lazy(() => import('./pages/Orders'));
const MenuBuilder      = lazy(() => import('./pages/MenuBuilder'));
const Customers        = lazy(() => import('./pages/Customers'));
const Coupons          = lazy(() => import('./pages/Coupons'));
const Analytics        = lazy(() => import('./pages/Analytics'));
const Settings         = lazy(() => import('./pages/Settings'));
const Payments         = lazy(() => import('./pages/Payments'));
const Staff            = lazy(() => import('./pages/Staff'));
const Inventory        = lazy(() => import('./pages/Inventory'));
const Locations        = lazy(() => import('./pages/Locations'));
const DeliveryZones    = lazy(() => import('./pages/DeliveryZones'));
const Reports          = lazy(() => import('./pages/Reports'));
const LiveBoard        = lazy(() => import('./pages/LiveBoard'));
const Broadcasts       = lazy(() => import('./pages/Broadcasts'));
const DeliveryDispatch = lazy(() => import('./pages/DeliveryDispatch'));
const DriverView       = lazy(() => import('./pages/Driver'));
const CateringAdmin    = lazy(() => import('./pages/CateringAdmin'));
const CareersAdmin     = lazy(() => import('./pages/Careers'));
const Reviews          = lazy(() => import('./pages/Reviews'));
const PaymentAccounts  = lazy(() => import('./pages/PaymentAccounts'));
const AuditLog         = lazy(() => import('./pages/AuditLog'));
const ChatInbox        = lazy(() => import('./pages/ChatInbox'));
const LoyaltyProgram   = lazy(() => import('./pages/LoyaltyProgram'));
const GlobalAddons     = lazy(() => import('./pages/GlobalAddons'));
const ArticlesAdmin    = lazy(() => import('./pages/ArticlesAdmin'));
const CashLog          = lazy(() => import('./pages/CashLog'));
const BusinessHours    = lazy(() => import('./pages/BusinessHours'));
const Drivers          = lazy(() => import('./pages/Drivers'));

import './App.css';

const PageLoader = () => <div className="admin-loading"><div className="spinner" aria-label="Loading" role="status" /></div>;

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  return (
    <div className="admin-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-main">
        <TopBar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <div className="admin-content">
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/orders"    element={<Orders />} />
            <Route path="/menu"      element={<MenuBuilder />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/coupons"   element={<Coupons />} />
            <Route path="/catering"         element={<CateringAdmin />} />
          <Route path="/careers"          element={<CareersAdmin />} />
            <Route path="/reviews"          element={<Reviews />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/payments"  element={<Payments />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="/staff"     element={<Staff />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/zones"     element={<DeliveryZones />} />
            <Route path="/reports"   element={<Reports />} />
            <Route path="/liveboard" element={<LiveBoard />} />
            <Route path="/broadcasts"  element={<Broadcasts />} />
            <Route path="/dispatch"   element={<DeliveryDispatch />} />
            <Route path="/cash-log"   element={<CashLog />} />
            <Route path="/payment-accounts" element={<PaymentAccounts />} />
            <Route path="/audit-log"      element={<AuditLog />} />
            <Route path="/chat"           element={<ChatInbox />} />
            <Route path="/loyalty"        element={<LoyaltyProgram />} />
            <Route path="/global-addons"  element={<GlobalAddons />} />
            <Route path="/articles"       element={<ArticlesAdmin />} />
            <Route path="/business-hours" element={<BusinessHours />} />
            <Route path="/drivers"        element={<Drivers />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function Guard() {
  const { isAdmin, loading } = useAdminAuth();
  if (loading) return <div className="admin-loading"><div className="spinner" aria-label="Loading" role="status" /></div>;
  if (!isAdmin) return <Login />;
  return <AdminLayout />;
}

function DriverGuard() {
  const { isAdmin, loading } = useAdminAuth();
  if (loading) return <div className="admin-loading"><div className="spinner" aria-label="Loading" role="status" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Suspense fallback={<PageLoader />}><DriverView /></Suspense>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/driver" element={<DriverGuard />} />
            <Route path="*" element={<Guard />} />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </ErrorBoundary>
  );
}
