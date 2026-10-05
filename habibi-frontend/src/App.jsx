import SEO from './components/SEO';
import React, { useEffect, lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Critical path — eagerly loaded (the landing page and the menu)
import Home from './pages/Home';

// Checkout, confirmation and sign-in load on the first visit to those pages.
// Bundled eagerly they made every other page download the whole checkout
// (the main file was 738 KB) before showing anything.
// Menu and the assistant were in the main bundle (~52 KB of the 507 KB every
// first visit downloads before anything renders). Menu is preloaded once the
// browser is idle (see preloadMenu below), so opening it still feels instant.
const loadMenu = () => import('./pages/Menu');
const Menu              = lazy(loadMenu);
const AssistantWidget   = lazy(() => import('./components/AssistantWidget'));
const Login             = lazy(() => import('./pages/Login'));
const Signup            = lazy(() => import('./pages/Signup'));
const Checkout          = lazy(() => import('./pages/Checkout'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));

// Lazy-loaded — split into separate chunks
const Locations        = lazy(() => import('./pages/Locations'));
const OrderTracking    = lazy(() => import('./pages/OrderTracking'));
const Reorder          = lazy(() => import('./pages/Reorder'));
const About            = lazy(() => import('./pages/About'));
const Careers          = lazy(() => import('./pages/Careers'));
const DepartmentDetail  = lazy(() => import('./pages/DepartmentDetail'));
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
const KitchenDisplay   = lazy(() => import('./pages/KitchenDisplay'));
const StaffLogin       = lazy(() => import('./pages/StaffLogin'));
const StaffSetPin      = lazy(() => import('./pages/StaffSetPin'));
const StaffQueue       = lazy(() => import('./pages/StaffQueue'));
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
const BuyGiftCard            = lazy(() => import('./pages/BuyGiftCard'));
const NotFound            = lazy(() => import('./pages/NotFound'));

import { initGA, initPixel, trackPageView } from './utils/analytics';
import { captureUtm } from './utils/utm';

const FULLSCREEN_ROUTES = ['/login', '/signup', '/register', '/forgot-password', '/reset-password', '/partner/login', '/partner', '/verify-email', '/kitchen', '/driver/login', '/driver/set-pin', '/staff/queue', '/staff/login', '/staff/set-pin'];

// Pages the ordering assistant floats on. See the mount below for why this is
// an allow-list and why checkout/account are not in it.
const ASSISTANT_EXACT = new Set(['/', '/locations', '/offers', '/deals']);
const ASSISTANT_PREFIXES = ['/menu'];   // /menu, /menu/:cat, /menu/item/:slug
function showsAssistant(pathname) {
  const p = (pathname || '').replace(/\/+$/, '') || '/';
  if (ASSISTANT_EXACT.has(p)) return true;
  return ASSISTANT_PREFIXES.some(pre => p === pre || p.startsWith(pre + '/'));
}

// Routes that must never appear in search results
const NOINDEX_PATHS = new Set([
  '/login', '/signup', '/register', '/forgot-password', '/reset-password',
  '/partner/login', '/partner', '/verify-email', '/kitchen', '/driver',
  '/checkout', '/payment', '/account', '/order-confirmation',
  '/order-tracking', '/reorder', '/admin/broadcasts',
  '/staff/queue', '/staff/login', '/staff/set-pin',
]);
function isNoIndexPath(pathname) {
  if (NOINDEX_PATHS.has(pathname)) return true;
  if (pathname === '*' || !pathname) return true;
  return false;
}

// Tells the boot screen in index.html that there is finally something to look
// at. It sits INSIDE the Suspense boundary on purpose: React will not commit it
// until the route's own chunk has resolved, so the loader lifts on the first
// real page paint rather than on a timer. Idempotent -- later navigations that
// re-suspend call it again and it does nothing.
function BootReady() {
  useEffect(() => { window.__habibiAppReady?.(); }, []);
  return null;
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
    // Fetch the Menu chunk while the visitor is still on the first page, so
    // the most-opened page never waits on a download. A rejected import is
    // harmless here: the real navigation retries it.
    const preloadMenu = () => { loadMenu().catch(() => {}); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preloadMenu, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(preloadMenu, 2500);
    return () => clearTimeout(t);
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
          {/* Legacy path from the original /menu/item/:slug deep-link scheme —
              redirect to the ?item= query-param version. A path segment here
              matched a different Route than plain /menu, and switching Route
              matches remounts the whole Menu page (refetches everything —
              visible as a "double load" when opening the item popup); a
              query param never changes which Route matches, so it doesn't. */}
          <Route path="/menu/item/:slug" element={<MenuItemRedirect />} />
          <Route path="/menu/:cat?" element={<Menu />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/order-tracking" element={<Page title="Track Your Order" h1 description="Enter your order number to see live status updates for your Habibi Halal Express order."><OrderTracking /></Page>} />
          <Route path="/reorder" element={<Page title="Reorder" noindex h1><Reorder /></Page>} />
          <Route path="/about" element={<About />} />
          <Route path="/careers" element={<Careers />} />
          {/* Same page as /careers -- the navbar's public "Staff" dropdown
              deep-links here with anchors (#management, #kitchen, #serving,
              #delivery, #stock) while its own "Hiring" item uses /careers
              directly. Two paths, one component, both pre-existing. This sat
              in the OUTER (Layout-bypassing) Routes block for a while after a
              route collision was fixed 2026-09-27 -- moved back in here,
              because that block has no Navbar/Footer, and a first attempt at
              the fix rendered this page with both missing. */}
          <Route path="/staff" element={<Careers />} />
          <Route path="/careers/departments/:id" element={<DepartmentDetail />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/wholesale" element={<Wholesale />} />
          <Route path="/login" element={<Page title="Log In" noindex h1><Login /></Page>} />
          <Route path="/checkout" element={<Page title="Checkout" noindex h1><Checkout /></Page>} />

          {/* Additional routes */}
          <Route path="/order" element={<Menu />} />
          <Route path="/signup" element={<Page title="Create an Account" h1 description="Create a Habibi Halal Express account for faster checkout, order history and rewards."><Signup /></Page>} />
          <Route path="/register" element={<Page title="Create an Account" h1 description="Create a Habibi Halal Express account for faster checkout, order history and rewards."><Signup /></Page>} />
          <Route path="/urgent" element={<Urgent />} />
          <Route path="/payment" element={<Page title="Quick Pay" description="Pay an outstanding order balance, catering deposit or wholesale invoice online, no account required."><Payment /></Page>} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/:slug" element={<ArticleDetail />} />
          <Route path="/account" element={<Page title="My Account" noindex><Account /></Page>} />
          <Route path="/order-confirmation" element={<Page title="Order Confirmation" noindex><OrderConfirmation /></Page>} />
          <Route path="/forgot-password" element={<Page title="Forgot Password" noindex><ForgotPassword /></Page>} />
          <Route path="/reset-password" element={<Page title="Reset Password" noindex><ResetPassword /></Page>} />
          <Route path="/partner/login" element={<PartnerLogin />} />
          <Route path="/partner" element={<PartnerPortal />} />
          <Route path="/verify-email" element={<Page title="Verify Email" noindex h1><VerifyEmail /></Page>} />
          <Route path="/catering" element={<Catering />} />
          <Route path="/gift-cards" element={<Page title="Gift Cards" description="Buy a Habibi Halal Express digital gift card, delivered instantly by email and redeemable on any order."><BuyGiftCard /></Page>} />
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
          <Route path="/unsubscribe"       element={<Page title="Unsubscribe" noindex><Unsubscribe /></Page>} />
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
          <Route path="*" element={<Page title="Page Not Found" noindex><NotFound /></Page>} />
        </Routes>
        <BootReady />
        </Suspense>
        </ErrorBoundary>
      </main>
      {!isFullscreen && <Footer />}
      {/* Browsing pages only. It was on every page once and was cut back to the
          home page by request, because a floating chat bubble competed with the
          task on checkout and account screens. That reason still holds: on
          mobile the widget (z-index 900) would sit directly on top of
          checkout's fixed Place Order bar (z-index 120).
          Menu, dish, locations and offers are where the questions it answers
          actually come up -- "is this spicy?", "what's in it?", "do you deliver
          to me?" -- so it earns its place there without covering anything that
          has to be completed.
          Deliberately an allow-list: a page added later gets no assistant until
          someone decides it should have one. */}
      {showsAssistant(location.pathname) && (
        <Suspense fallback={null}><AssistantWidget /></Suspense>
      )}
    </>
  );
}

function MenuItemRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/menu?item=${encodeURIComponent(slug)}`} replace />;
}

function InternalGuard({ children, requireAdmin = false }) {
  // Read from AuthContext (populated via /api/auth/me on load) — no localStorage token needed
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #d97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !['admin', 'superadmin'].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// Which app "Add to Home Screen" installs from a given page. Every route is
// served the same index.html, and with it the customer manifest -- so on
// Android a driver installing from /driver got an icon that opened the menu.
// Each staff-facing section now points at its own manifest, with its own id
// (so a device keeps them as separate apps) and its own start_url and scope.
// iOS ignores manifests and takes the icon name from apple-mobile-web-app-title,
// so that follows along. Order matters only in that the first match wins.
const INSTALLABLE_APPS = [
  // bareMatch: false -- unlike /driver and /kitchen, bare /staff is not part
  // of this app: it's the public careers page (see the route comment above).
  // Only the staff-facing sub-paths (login, set-pin, the queue itself) get
  // this manifest; matching bare /staff too would offer the STAFF install
  // prompt to a customer reading about jobs. Found and fixed 2026-09-27.
  { prefix: '/staff',   manifest: '/manifest-staff.json',   title: 'Habibi Staff', bareMatch: false },
  // The driver app's manifest predates this table and DriverLogin/DriverView
  // also switch to it themselves. Same file on purpose: its identity (no id, so
  // Chrome keys it on start_url /driver/login) must not change, or drivers who
  // already installed it would get a second app instead of an update.
  { prefix: '/driver',  manifest: '/driver-manifest.json',  title: 'Habibi Driver' },
  { prefix: '/kitchen', manifest: '/manifest-kitchen.json', title: 'Habibi Kitchen' },
];
const CUSTOMER_APP = { manifest: '/manifest.json', title: 'Habibi' };
const appForPath = (p) =>
  INSTALLABLE_APPS.find(a => (a.bareMatch !== false && p === a.prefix) || p.startsWith(a.prefix + '/')) || CUSTOMER_APP;

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Set robots meta — noindex for private/functional pages
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) {
      robots.setAttribute('content', isNoIndexPath(pathname) ? 'noindex, nofollow' : 'index, follow');
    }
    const app = appForPath(pathname);
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', app.manifest);
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', app.title);
  }, [pathname]);

  return null;
}


// Title (and, where the page has none, a hidden main heading) for pages that
// do not set their own <SEO>. Private pages are noindex.
function Page({ title, description, noindex = false, h1 = false, children }) {
  return (
    <>
      <SEO title={title} description={description} noindex={noindex} />
      {h1 && <h1 className="sr-only">{title}</h1>}
      {children}
    </>
  );
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
          <Route path="/kitchen" element={<InternalGuard requireAdmin><KitchenDisplay /></InternalGuard>} />
          <Route path="/staff/login"    element={<StaffLogin />} />
          <Route path="/staff/set-pin"  element={<StaffSetPin />} />
          {/* The internal kitchen/counter queue. NOT at bare /staff -- the
              navbar's public "Staff" dropdown already owned that path (it
              renders <Careers />, matched inside Layout's own inner Routes,
              same as /careers) before this feature existed. Putting the
              queue there too silently broke that public link: every visitor
              clicking Staff in the navbar landed on this login screen
              instead. Found and fixed 2026-09-27 -- keep this nested so the
              two can never collide again. */}
          <Route path="/staff/queue"    element={<StaffQueue />} />
          <Route path="*" element={<Layout />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
