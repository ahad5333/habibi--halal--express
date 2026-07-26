import React, { useEffect, useRef, lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Critical path — eagerly loaded
import Home from './pages/Home';
import Menu from './pages/Menu';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';

// Lazy-loaded — split into separate chunks
const Locations        = lazy(() => import('./pages/Locations'));
const OrderTracking    = lazy(() => import('./pages/OrderTracking'));
const About            = lazy(() => import('./pages/About'));
const Careers          = lazy(() => import('./pages/Careers'));
const Contact          = lazy(() => import('./pages/Contact'));
const Wholesale        = lazy(() => import('./pages/Wholesale'));
const Account          = lazy(() => import('./pages/Account'));
const Videos               = lazy(() => import('./pages/Videos'));
const Articles             = lazy(() => import('./pages/Articles'));
const ArticleDetail        = lazy(() => import('./pages/ArticleDetail'));
const Urgent           = lazy(() => import('./pages/Urgent'));
const Payment          = lazy(() => import('./pages/Payment'));
const ForgotPassword   = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword    = lazy(() => import('./pages/ResetPassword'));
const PartnerLogin     = lazy(() => import('./pages/PartnerLogin'));
const PartnerPortal    = lazy(() => import('./pages/PartnerPortal'));
const VerifyEmail      = lazy(() => import('./pages/VerifyEmail'));
const DriverView       = lazy(() => import('./pages/DriverView'));
const DriverLogin      = lazy(() => import('./pages/DriverLogin'));
const DriverSetPin     = lazy(() => import('./pages/DriverSetPin'));
const DineIn           = lazy(() => import('./pages/DineIn'));
const KitchenDisplay   = lazy(() => import('./pages/KitchenDisplay'));
const Catering         = lazy(() => import('./pages/Catering'));
const Broadcasts       = lazy(() => import('./pages/Broadcasts'));
const HealthSafety     = lazy(() => import('./pages/HealthSafety'));
const PrivacyPolicy    = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService   = lazy(() => import('./pages/TermsOfService'));
const SmsTerms         = lazy(() => import('./pages/SmsTerms'));
const Accessibility    = lazy(() => import('./pages/Accessibility'));
const Legal            = lazy(() => import('./pages/Legal'));
const Reviews             = lazy(() => import('./pages/Reviews'));
const Unsubscribe         = lazy(() => import('./pages/Unsubscribe'));
const DeliveryCoverage    = lazy(() => import('./pages/DeliveryCoverage'));
const GroupOrder          = lazy(() => import('./pages/GroupOrder'));
const CustomOrder         = lazy(() => import('./pages/CustomOrder'));
const Offers              = lazy(() => import('./pages/Offers'));
const KitchenBehindScenes    = lazy(() => import('./pages/KitchenBehindScenes'));
const CustomerStories        = lazy(() => import('./pages/CustomerStories'));
const OurJourney             = lazy(() => import('./pages/OurJourney'));
const NotFound            = lazy(() => import('./pages/NotFound'));

import { initGA, initPixel, trackPageView } from './utils/analytics';
import { captureUtm } from './utils/utm';

const FULLSCREEN_ROUTES = ['/login', '/signup', '/register', '/forgot-password', '/reset-password', '/partner/login', '/partner', '/verify-email', '/kitchen', '/driver/login', '/driver/set-pin'];

// Routes that must never appear in search results
const NOINDEX_PATHS = new Set([
  '/login', '/signup', '/register', '/forgot-password', '/reset-password',
  '/partner/login', '/partner', '/verify-email', '/kitchen', '/driver',
  '/checkout', '/payment', '/account', '/order-confirmation',
  '/order-tracking', '/admin/broadcasts',
]);
function isNoIndexPath(pathname) {
  if (NOINDEX_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/dine-in/')) return true;
  if (pathname === '*' || !pathname) return true;
  return false;
}

function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const isFullscreen = FULLSCREEN_ROUTES.includes(location.pathname);

  useEffect(() => {
    // Initialize analytics on boot and capture UTM params if present
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const pixelId = import.meta.env.VITE_FB_PIXEL_ID;
    initGA(gaId);
    initPixel(pixelId);
    captureUtm();
  }, []);

  useEffect(() => {
    // Track page views on location change
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    if (sessionStorage.getItem('push_prompted')) return;
    sessionStorage.setItem('push_prompted', '1');
    const t = setTimeout(async () => {
      const { requestPushPermission, isFirebaseConfigured } = await import('./utils/pushNotifications.js');
      if (isFirebaseConfigured()) requestPushPermission();
    }, 5000);
    return () => clearTimeout(t);
  }, [user]);

  return (
    <>
      {!isFullscreen && <Navbar />}
      <main>
        <ErrorBoundary key={location.pathname}>
        <Suspense fallback={
          <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #d97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        }>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Shareable deep link — opens the Menu page with this item's popup
              already open, rather than the separate full-page layout (client
              found the dedicated page's image/layout quality noticeably worse
              than the popup, so the popup stays the real UX either way). */}
          <Route path="/menu/item/:slug" element={<Menu />} />
          <Route path="/menu/:cat?" element={<Menu />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/order-tracking" element={<OrderTracking />} />
          <Route path="/about" element={<About />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/wholesale" element={<Wholesale />} />
          <Route path="/login" element={<Login />} />
          <Route path="/checkout" element={<Checkout />} />

          {/* Additional routes */}
          <Route path="/order" element={<Menu />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/register" element={<Signup />} />
          <Route path="/urgent" element={<Urgent />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/staff" element={<Careers />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/:slug" element={<ArticleDetail />} />
          <Route path="/account" element={<Account />} />
          <Route path="/order-confirmation" element={<OrderConfirmation />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/partner/login" element={<PartnerLogin />} />
          <Route path="/partner" element={<PartnerPortal />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/dine-in/:tableSlug" element={<DineIn />} />
          <Route path="/catering" element={<Catering />} />
          <Route path="/admin/broadcasts" element={<InternalGuard requireAdmin><Broadcasts /></InternalGuard>} />

          {/* Legal hub */}
          <Route path="/legal"          element={<Legal />} />
          {/* Legacy standalone routes — kept for direct links */}
          <Route path="/health-safety"  element={<HealthSafety />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms"          element={<TermsOfService />} />
          <Route path="/sms-terms"      element={<SmsTerms />} />
          <Route path="/accessibility"  element={<Accessibility />} />
          <Route path="/reviews"           element={<Reviews />} />
          <Route path="/reviews/new"       element={<Reviews />} />
          <Route path="/unsubscribe"       element={<Unsubscribe />} />
          <Route path="/delivery-coverage" element={<DeliveryCoverage />} />
          <Route path="/where-we-deliver"  element={<DeliveryCoverage />} />

          {/* Group Orders */}
          <Route path="/group-order"              element={<GroupOrder />} />
          <Route path="/group-order/:sessionId"   element={<GroupOrder />} />
          <Route path="/customize"                element={<CustomOrder />} />
          <Route path="/offers"                   element={<Offers />} />
          <Route path="/deals"                    element={<Offers />} />
          <Route path="/kitchen-behind-the-scenes" element={<KitchenBehindScenes />} />
          <Route path="/customer-stories"          element={<CustomerStories />} />
          <Route path="/our-journey"               element={<OurJourney />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      {!isFullscreen && <Footer />}
    </>
  );
}

function InternalGuard({ children, requireAdmin = false }) {
  // Read from AuthContext (populated via /api/auth/me on load) — no localStorage token needed
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #d97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !['admin', 'superadmin'].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    const prevPath = prevPathname.current;
    prevPathname.current = pathname;

    // Opening/closing the menu item popup swaps the URL between /menu... and
    // /menu/item/:slug (for the shareable link), but it isn't a real page
    // navigation — don't yank the customer's scroll position when that happens.
    const isMenuModalToggle =
      prevPath.startsWith('/menu') && pathname.startsWith('/menu') &&
      (prevPath.startsWith('/menu/item/') || pathname.startsWith('/menu/item/'));

    if (!isMenuModalToggle) {
      window.scrollTo(0, 0);
    }

    // Set robots meta — noindex for private/functional pages
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) {
      robots.setAttribute('content', isNoIndexPath(pathname) ? 'noindex, nofollow' : 'index, follow');
    }
  }, [pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a' }} />}>
        <Routes>
          <Route path="/driver"          element={<DriverView />} />
          <Route path="/driver/login"    element={<DriverLogin />} />
          <Route path="/driver/set-pin"  element={<DriverSetPin />} />
          <Route path="/kitchen" element={<InternalGuard><KitchenDisplay /></InternalGuard>} />
          <Route path="*" element={<Layout />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
