# Habibi Halal Express — Advanced Features Added

> Personal notes on every advanced feature built on top of the core ordering system.
> All features span backend (Express/PostgreSQL) + frontend (React/Vite) + admin (React/Vite).

---

## 1. Table QR Code Dine-In Mode

**What it does:** Each restaurant table gets a unique QR code. Customer scans it → lands on a welcome page → sessions is locked to that table → orders through the normal flow without staff involvement. Orders are tagged `delivery_method = 'dine_in'` and `table_number` so the kitchen knows which table to serve.

**Files added / changed:**

| File | Change |
|------|--------|
| `habibi-backend/src/config/init.js` | New `dine_in_tables` table (id, table_name, qr_slug, is_active) + `ALTER TABLE guest_orders ADD COLUMN table_number` |
| `habibi-backend/src/routes/dineInRoutes.js` | NEW — 6 REST endpoints: `GET /tables`, `POST /tables`, `PUT /tables/:id`, `DELETE /tables/:id`, `GET /tables/by-slug/:slug` (public), `GET /kitchen` (public) |
| `habibi-backend/src/app.js` | Mounted `dineInRoutes` at `/api/dine-in` |
| `habibi-frontend/src/context/DineInContext.jsx` | NEW — React context; persists table session in `localStorage` key `habibi_table`; provides `isDineIn`, `table`, `setTable`, `clearTable` |
| `habibi-frontend/src/main.jsx` | Wrapped app in `<DineInProvider>` (inside AuthProvider, outside CartProvider) |
| `habibi-frontend/src/pages/DineIn.jsx` | NEW — `/dine-in/:tableSlug` landing page; fetches table by slug, sets context, shows 3-step how-it-works + CTA |
| `habibi-frontend/src/pages/DineIn.css` | NEW — Dark theme, gold accents |
| `habibi-frontend/src/pages/Checkout.jsx` | Reads `isDineIn` + `dineInTable` from context; swaps delivery form for simple name/phone; sets `delivery_fee = 0`; shows dine-in banner |
| `habibi-frontend/src/pages/Checkout.css` | Added `.dine-in-banner` styles |
| `habibi-frontend/src/App.jsx` | Added `/dine-in/:tableSlug` route |
| `habibi-admin/src/pages/TableManager.jsx` | NEW — Full CRUD for tables; QR preview via Google Charts API (no npm dep); QR modal with copy URL + print |
| `habibi-admin/src/pages/TableManager.css` | NEW |
| `habibi-admin/src/App.jsx` | Added `/tables` route |
| `habibi-admin/src/components/Sidebar.jsx` | Added "Dine-In Tables" nav item with `QrCode` icon |

**Key design decisions:**
- QR slug is auto-generated as `tableName-timestamp36` (base-36 timestamp suffix ensures uniqueness)
- QR images use Google Charts API URL: `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=<URL>` — zero npm dependencies
- Table session survives React Router navigation via `localStorage` so dine-in mode persists from `/dine-in/slug` → `/menu` → `/checkout`
- Kitchen display at `/kitchen` polls `GET /api/dine-in/kitchen` every 30 seconds

---

## 2. Live Kitchen Queue Status

**What it does:** Order Tracking page shows "X orders ahead of yours" in real time. Position updates every time an admin changes any order status, using the existing Socket.IO connection. Shows a dot visualization — grey dots = orders ahead, gold pulsing dot = your order.

**Files added / changed:**

| File | Change |
|------|--------|
| `habibi-backend/src/routes/orderRoutes.js` | Added `GET /queue/:orderNumber` — counts active orders placed before this one |
| `habibi-backend/src/controllers/adminController.js` | After every `order_status_updated` emit, re-ranks all `pending/accepted/preparing` orders by `placed_at ASC` and emits `queue_update { position: idx }` to each order's socket room |
| `habibi-frontend/src/pages/OrderTracking.jsx` | Added `queuePosition` state; calls `/api/orders/queue/:orderNumber` on load; listens to `queue_update` socket event; renders queue widget when `currentStep <= 3` |
| `habibi-frontend/src/pages/OrderTracking.css` | Added `.ot-queue-widget`, `.ot-queue-dot`, `.ot-queue-dot.you.pulse`, `@keyframes queuePulse` |

**Key design decisions:**
- O(n) re-rank on every status change: fetch all active orders sorted by `placed_at ASC`, emit position `0, 1, 2...` to each room. Position 0 = next up = "You're next! 🔥"
- Socket room per order: `order_{orderNumber}` — already existed for status updates, reused for queue
- Widget hides itself once order reaches step 4+ (ready/delivered) — no more queue info needed then
- Dot visualization: up to 5 grey dots shown for orders ahead, `+N` label if more than 5, gold pulsing dot always represents your order

---

## 3. Catering / Event Quote System

**What it does:** A `/catering` page with a 3-step multi-step form (Event Details → Your Details → Review & Submit). Customer gets a quote reference number. Admin reviews quotes and sends a custom invoice email with quoted price and deposit terms.

**Files added / changed:**

| File | Change |
|------|--------|
| `habibi-backend/src/config/init.js` | Expanded `reservations` table: `scheduled_date` changed to TIMESTAMPTZ; added columns `event_type`, `service_type`, `estimated_total`, `admin_notes`, `invoice_sent`, `quoted_price` |
| `habibi-backend/src/controllers/reservationController.js` | FULL REWRITE — fixed broken INSERT (was using wrong column names); added `PRICE_PER_HEAD` pricing logic; sends confirmation email to customer + alert email to admin on submission; added `getReservationById`, `sendInvoice` functions |
| `habibi-backend/src/routes/reservationRoutes.js` | Added `GET /admin/:id` and `POST /admin/:id/invoice` |
| `habibi-backend/src/services/emailService.js` | Added 3 functions: `sendCateringQuoteConfirmation`, `sendCateringAdminAlert`, `sendCateringInvoice` (includes 25% deposit terms) |
| `habibi-frontend/src/pages/Catering.jsx` | NEW — 3-step form: event type grid (8 types), date/time pickers, guest count slider (10–500), service type (delivery/pickup/on-site), personal details, review screen, success screen with `#CAT-XXXX` reference |
| `habibi-frontend/src/pages/Catering.css` | NEW — Full dark theme, step indicator, event type grid, guest slider, estimate block |
| `habibi-frontend/src/App.jsx` | Added `/catering` route |
| `habibi-frontend/src/components/Navbar.jsx` | Added "Catering & Events 🍽️" sub-link under "Order Online" dropdown |
| `habibi-admin/src/pages/CateringAdmin.jsx` | NEW — Lists all quotes (pending first), expandable detail rows, "Send Invoice" modal with quoted price + admin notes fields |
| `habibi-admin/src/App.jsx` | Added `/catering` route |
| `habibi-admin/src/components/Sidebar.jsx` | Added "Catering Quotes" nav item with `CalendarDays` icon |

**Pricing tiers (matching backend + frontend):**

| Guests | Price/Person |
|--------|-------------|
| 10–30  | $18 |
| 31–50  | $16 |
| 51–100 | $14 |
| 100+   | $12 |
| Minimum order | $200 |

**Key design decisions:**
- Live estimate pill updates as guest count slider moves — no submit needed to see price
- Minimum $200: `estimateTotal = Math.max(200, guests * PRICE_PER_HEAD(guests))`
- Customer gets quote reference `#CAT-0001` style — actual ID padded to 4 digits
- No payment at quote stage — admin reviews and sends invoice separately
- Invoice email includes 25% deposit requirement and full quoted price

---

## 4. AI-Powered Order Recommendations

**What it does:** A horizontal scrollable "recommendation band" component that appears on the Menu page. Shows personalized or popular item suggestions with one-click add-to-cart. Uses SQL-based collaborative filtering on order history — no external AI API needed.

**Files added / changed:**

| File | Change |
|------|--------|
| `habibi-backend/src/controllers/aiController.js` | Added `getRecommendations` function with 4 recommendation types (see below) |
| `habibi-backend/src/routes/aiRoutes.js` | Added `GET /recommendations` route |
| `habibi-frontend/src/components/RecommendationBand.jsx` | NEW — Horizontal scroll component; fetches recommendations; left/right scroll buttons; add-to-cart with "✓ Added" flash state |
| `habibi-frontend/src/components/RecommendationBand.css` | NEW — Dark theme cards, scroll track, add button states |
| `habibi-frontend/src/pages/Menu.jsx` | Imported `RecommendationBand` + `useAuth`; renders band above category header; passes `type="for_you"` + email when logged in, `type="popular"` for guests |

**Recommendation types:**

| Type | Query param | Logic |
|------|-------------|-------|
| `popular` | `?type=popular` | Ranks `menu_items` by order frequency in `guest_orders` over last 90 days via `jsonb_array_elements(items)` |
| `for_you` | `?type=for_you&email=x` | Items the customer has NOT ordered in last 180 days, sorted by overall popularity |
| `also_liked` | `?type=also_liked&item_name=x` | Co-occurrence collaborative filtering: finds orders containing `item_name`, ranks other items in those same orders by frequency |
| `new` | `?type=new&email=x` | Items added to `menu_items` within last 30 days that customer hasn't tried; pads to 4 items with untried popular items |

**Key design decisions:**
- Zero external AI dependency — pure SQL using `jsonb_array_elements` on the existing `guest_orders.items` JSONB column
- `also_liked` falls back to popular items if collaborative filtering returns no results (e.g. new item with no order history)
- Component returns `null` if loading or empty — invisible if recommendations aren't ready, no layout shift
- Band renders above the menu grid but below the search bar so it's seen before category browsing

---

## 5. Kitchen Display (Tablet View)

**What it does:** A fullscreen tablet-optimized view at `/kitchen` showing all active dine-in and regular orders with color-coded status cards. No navbar or footer. Polls every 30 seconds.

**Files added / changed:**

| File | Change |
|------|--------|
| `habibi-backend/src/routes/dineInRoutes.js` | `GET /kitchen` returns active orders (not delivered/cancelled) from `guest_orders` |
| `habibi-frontend/src/pages/KitchenDisplay.jsx` | NEW — `/kitchen` fullscreen view; `setInterval` poll every 30s; status color coding; elapsed time since placed |
| `habibi-frontend/src/pages/KitchenDisplay.css` | NEW — Dark fullscreen layout, color-coded status cards |
| `habibi-frontend/src/App.jsx` | Added `/kitchen` outside `<Layout>` (no nav/footer); added to `FULLSCREEN_ROUTES` |

**Status colors:**
- `pending` → yellow
- `confirmed/accepted` → blue
- `preparing` → orange
- `ready` → green

---

## Summary — All New Files

```
habibi-backend/src/
  routes/dineInRoutes.js          (NEW)
  controllers/reservationController.js  (FULL REWRITE)

habibi-frontend/src/
  context/DineInContext.jsx        (NEW)
  pages/DineIn.jsx                 (NEW)
  pages/DineIn.css                 (NEW)
  pages/Catering.jsx               (NEW)
  pages/Catering.css               (NEW)
  pages/KitchenDisplay.jsx         (NEW)
  pages/KitchenDisplay.css         (NEW)
  components/RecommendationBand.jsx (NEW)
  components/RecommendationBand.css (NEW)

habibi-admin/src/
  pages/TableManager.jsx           (NEW)
  pages/TableManager.css           (NEW)
  pages/CateringAdmin.jsx          (NEW)
```

## Summary — All Modified Files

```
habibi-backend/src/
  config/init.js                   (new tables + ALTER TABLE statements)
  app.js                           (mounted dineInRoutes)
  routes/orderRoutes.js            (added queue endpoint)
  routes/reservationRoutes.js      (added admin/:id and invoice routes)
  routes/aiRoutes.js               (added recommendations route)
  controllers/adminController.js   (added queue broadcast after status update)
  controllers/aiController.js      (added getRecommendations, fixed getKitchenStats)
  services/emailService.js         (added 3 catering email functions)

habibi-frontend/src/
  main.jsx                         (added DineInProvider)
  App.jsx                          (added /catering, /dine-in/:slug, /kitchen routes)
  components/Navbar.jsx            (added Catering link under Order Online)
  pages/Checkout.jsx               (dine-in mode: banner, form swap, fee=0, payload)
  pages/Checkout.css               (added .dine-in-banner)
  pages/OrderTracking.jsx          (queue widget + socket listener)
  pages/OrderTracking.css          (queue dot styles + pulse animation)
  pages/Menu.jsx                   (RecommendationBand integration + useAuth)

habibi-admin/src/
  App.jsx                          (added /tables, /catering routes)
  components/Sidebar.jsx           (added Dine-In Tables + Catering Quotes nav items)
```
