import React from 'react';
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
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import MenuBuilder from './pages/MenuBuilder';
import Customers from './pages/Customers';
import Coupons from './pages/Coupons';
import Partners from './pages/Partners';
import Analytics from './pages/Analytics';
import UrgentRequests from './pages/UrgentRequests';
import Settings from './pages/Settings';
import Payments from './pages/Payments';
import Staff from './pages/Staff';
import Inventory from './pages/Inventory';
import Locations from './pages/Locations';
import DeliveryZones from './pages/DeliveryZones';
import Reports from './pages/Reports';
import LiveBoard from './pages/LiveBoard';
import Broadcasts from './pages/Broadcasts';
import DeliveryDispatch from './pages/DeliveryDispatch';
import MarketplaceOrders from './pages/MarketplaceOrders';
import RoadieDeliveries from './pages/RoadieDeliveries';
import DriverView from './pages/Driver';
import BusinessMenuAdmin from './pages/BusinessMenuAdmin';
import PartnerOrders from './pages/PartnerOrders';
import TableManager from './pages/TableManager';
import CateringAdmin from './pages/CateringAdmin';
import TableReservations from './pages/TableReservations';
import CareersAdmin from './pages/Careers';
import Reviews from './pages/Reviews';
import Integrations from './pages/Integrations';
import PlatformCredentials from './pages/PlatformCredentials';
import AuditLog from './pages/AuditLog';
import ChatInbox from './pages/ChatInbox';
import LoyaltyProgram from './pages/LoyaltyProgram';
import './App.css';

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  return (
    <div className="admin-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-main">
        <TopBar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <div className="admin-content">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/orders"    element={<Orders />} />
            <Route path="/menu"      element={<MenuBuilder />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/coupons"   element={<Coupons />} />
            <Route path="/partners"        element={<Partners />} />
            <Route path="/wholesale-catalog" element={<BusinessMenuAdmin />} />
            <Route path="/partner-orders"    element={<PartnerOrders />} />
            <Route path="/tables"           element={<TableManager />} />
            <Route path="/reservations"     element={<TableReservations />} />
            <Route path="/catering"         element={<CateringAdmin />} />
          <Route path="/careers"          element={<CareersAdmin />} />
            <Route path="/reviews"          element={<Reviews />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/payments"  element={<Payments />} />
            <Route path="/urgent"    element={<UrgentRequests />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="/staff"     element={<Staff />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/zones"     element={<DeliveryZones />} />
            <Route path="/reports"   element={<Reports />} />
            <Route path="/liveboard" element={<LiveBoard />} />
            <Route path="/broadcasts"  element={<Broadcasts />} />
            <Route path="/dispatch"   element={<DeliveryDispatch />} />
            <Route path="/marketplace"   element={<MarketplaceOrders />} />
            <Route path="/roadie"   element={<RoadieDeliveries />} />
            <Route path="/integrations"   element={<Integrations />} />
            <Route path="/credentials"    element={<PlatformCredentials />} />
            <Route path="/audit-log"      element={<AuditLog />} />
            <Route path="/chat"           element={<ChatInbox />} />
            <Route path="/loyalty"        element={<LoyaltyProgram />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
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
  return <DriverView />;
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
