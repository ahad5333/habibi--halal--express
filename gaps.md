# Habibi Halal Express — Gap Analysis
**Updated:** 2026-06-11 (post all sessions — all modules code-complete)
**Status key:** ✅ Done · 🔶 Partial · ❌ Missing · ⏳ Waiting on external approval

---

## Milestone Tracking

> **Rule:** No coding is blocking any milestone. Everything below is waiting on client-side account setups or third-party partner approvals.

| Milestone | Description | Code | Blocking |
|---|---|---|---|
| **M1** | Full Website + CPanel Live | ✅ 100% done | API keys from client (see below) |
| **M2** | Integrations Live (UberEats + DoorDash + GrubHub) | ✅ 100% done | Tech Partner approval (see below) |
| **M3** | Customer Ordering Apps Live (Android + iOS) | ✅ 100% done | Store accounts + API approvals (see below) |
| **M4** | Merchant Tablet App Live | 🔶 Needs full testing | Depends on M3 accounts being set up |
| **M5** | Business Wholesale App Live | 🔶 Needs full testing | Depends on M3 accounts being set up |

---

## Milestone 1 — Full Website + CPanel Live
**Code: ✅ Complete. Server deployed at habibihe.com. Waiting on API keys only.**

### Server `.env` — still placeholder/missing (update via `nano /var/www/habibi/habibi-backend/.env` then `pm2 restart habibi-backend`)

| Env Var | Current Value | What's Needed | Who Gets It |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | We change it |
| `FRONTEND_URL` | `http://localhost:5175` | `https://habibihe.com` | We change it |
| `CORS_ORIGINS` | localhost only | `https://habibihe.com,https://www.habibihe.com` | We change it |
| ~~`STRIPE_SECRET_KEY`~~ | ~~removed~~ | ~~Not needed — replaced by Authorize.net~~ | — |
| `AUTHNET_API_LOGIN_ID` | *(not set)* | From VAR sheet — add via admin CPanel Payment Accounts page | Client — VAR sheet from merchant processor |
| `AUTHNET_TRANSACTION_KEY` | *(not set)* | From VAR sheet — add via admin CPanel | Client — VAR sheet |
| `AUTHNET_CLIENT_KEY` | *(not set)* | From merchant portal → Account → Manage Public Client Key | Client — Authorize.net merchant portal |
| `PAYPAL_CLIENT_ID` | `REPLACE_ME` | Real production ID | Client — developer.paypal.com |
| `PAYPAL_CLIENT_SECRET` | `REPLACE_ME` | Real production secret | Client — same page |
| `PAYPAL_MODE` | `sandbox` | `production` | We change it once PayPal keys arrive |
| `SENDGRID_API_KEY` | *(empty)* | `SG.xxxx` — **also activates admin MFA** | Client — app.sendgrid.com |
| `EMAIL_FROM` | `noreply@habibihalal.com` | Verified sender (e.g. `orders@habibihe.com`) | Client — SendGrid domain auth |
| `TWILIO_ACCOUNT_SID` | *(empty)* | `ACxxxx` | Client — console.twilio.com |
| `TWILIO_AUTH_TOKEN` | *(empty)* | Real token | Client — same page |
| `TWILIO_PHONE_NUMBER` | *(empty)* | `+1xxxxxxxxxx` | Client — buy number in Twilio |
| `GOOGLE_MAPS_API_KEY` | `SIMULATED` | `AIzaxxxx` (enable Distance Matrix + Places + Geocoding APIs) | Client — console.cloud.google.com |

### Frontend `.env` — still placeholder (update locally, rebuild, redeploy dist/ to server)

| Env Var | Current Value | What's Needed |
|---|---|---|
| ~~`VITE_STRIPE_PUBLISHABLE_KEY`~~ | ~~removed~~ | ~~Not needed — replaced by Authorize.net Accept.js~~ |
| `VITE_PAYPAL_CLIENT_ID` | `REPLACE_ME` | Real PayPal client ID |
| `VITE_GOOGLE_MAPS_KEY` | *(missing)* | Same Google Maps key as backend |
| `VITE_GA_MEASUREMENT_ID` | `G-MOCKTRACKER` | Real GA4 ID from analytics.google.com |
| `VITE_FB_PIXEL_ID` | `123456789012345` | Real Pixel ID from Facebook Business |

### Already set on server ✅
- `CREDENTIAL_ENCRYPTION_KEY` — set
- `HEALTH_SECRET` — set
- `DB_*` — local PostgreSQL running
- `JWT_SECRET` — set
- `ZELLE_EMAIL`, `CASHAPP_CASHTAG` — set

### Effort once keys arrive
~1 hour: update `.env` → `pm2 restart` → update frontend `.env` → `npm run build` → copy `dist/` to server.

---

## Milestone 2 — Integrations Live (UberEats + DoorDash + GrubHub)
**Code: ✅ Complete. All integrations built and simulated. Zero code changes needed when approvals arrive — just swap env vars.**
⏱️ Timeline depends on Tech Partner approval.

| Platform | What's Built | Current State | Blocking | Env Var to Swap |
|---|---|---|---|---|
| **DoorDash Drive** | Auto-dispatch, webhook, admin list/cancel | Simulated | DoorDash Developer account approval | `DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET` |
| **Roadie** | Long-distance dispatch (10+ mi), webhook, admin list | Simulated | Roadie API key from roadie.com | `ROADIE_API_KEY` |
| **UberEats** | Webhook receiver, order normalisation, admin tab | Ready | UberEats Restaurant Manager API partner approval | No new var — webhook URL registered in UberEats portal |
| **GrubHub** | Webhook receiver, order normalisation, admin tab | Ready | GrubHub partner-level API access | No new var — webhook URL registered in GrubHub portal |
| **Caviar** | Webhook receiver (DoorDash-backed format) | Ready | No extra approval needed | No new var |

> Webhook URLs to register with each platform once approved:
> - DoorDash: `https://habibihe.com/api/doordash/webhook`
> - Roadie: `https://habibihe.com/api/roadie/webhook`
> - UberEats: `https://habibihe.com/api/marketplace/webhook/ubereats`
> - GrubHub: `https://habibihe.com/api/marketplace/webhook/grubhub`
> - Caviar: `https://habibihe.com/api/marketplace/webhook/caviar`

---

## Milestone 3 — Customer Ordering Apps Live (Android + iOS)
**Code: ✅ Complete. All 19 feature gaps resolved. Waiting on store accounts and API approvals.**

| Blocking item | Details | Who Gets It |
|---|---|---|
| **EAS project ID** | Create Expo account → `eas init` in `habibi-mobile/` | Client |
| **Google Play Developer account** | $25 one-time fee, ~1–3 day review | Client — play.google.com/console |
| **Apple Developer account** | $99/year, ~24–48 hr review | Client — developer.apple.com |
| **APNs certificate** | Comes with Apple Developer account — needed for iOS push | Client |
| **Firebase project** | Free, 10 min setup — provides FCM push for both platforms | Client — console.firebase.google.com |
| `FCM_SERVER_KEY` + `FCM_PROJECT_ID` | From Firebase project settings | Client adds to server `.env` |
| **Google Maps mobile key** | Same Google Cloud project as M1 key, add iOS + Android app restrictions | Client |

> Once EAS is set up: `eas build --platform all` submits builds to both stores. Apple review takes 1–3 days, Google review takes 1–3 days.

---

## Milestone 4 — Merchant Tablet App Live
**Code: 🔶 Screens built, needs full end-to-end testing before store submission.**
Depends on M3 accounts (same EAS + store accounts, same Firebase).

Features to test before submission:
- [ ] Live order board — incoming → preparing → ready → delivered
- [ ] Accept / reject orders with one tap
- [ ] Print receipt (Bluetooth thermal printer)
- [ ] End-of-day sales summary
- [ ] Item availability toggle (mark sold out)

---

## Milestone 5 — Business Wholesale App Live
**Code: 🔶 Screens built, needs full end-to-end testing before store submission.**
Depends on M3 accounts (same EAS + store accounts).

Features to test before submission:
- [ ] Partner login (same credentials as web portal)
- [ ] Browse business catalog at tier prices
- [ ] Bulk order cart
- [ ] Order history + invoices
- [ ] Request custom quote

---

## Deliverable Overview (from project spec)

| # | Deliverable | Status | Completion |
|---|---|---|---|
| 1 | Restaurant ordering website (habibihe.com) | ✅ | 100% — code done, server deployed |
| 2 | Admin CPanel | ✅ | 100% — code done, server deployed |
| 3 | Android customer ordering app | ✅ | 100% code — waiting on Play Store account |
| 4 | iOS customer ordering app | ✅ | 100% code — waiting on Apple Developer account |
| 5 | Android tablet merchant app (Habibi Merchant) | 🔶 | Code built — needs testing |
| 6 | Business wholesale Android & iOS app | 🔶 | Code built — needs testing (web portal ✅ live) |

> All coding is complete. No module is blocked by missing code. All remaining items are external accounts, API approvals, or testing.

---

## Phase 1 — Website: Menu & Ordering

### ✅ Done
- 22 frontend pages (Home, Menu, About, Contact, Locations, Login, Signup, Account, Checkout, Payment, OrderTracking, Careers, Videos, Wholesale, Urgent, ForgotPassword, ResetPassword, PartnerLogin, PartnerPortal, DriverView, OrderConfirmation, VerifyEmail)
- 172 real menu items seeded from `menus` table, 9 categories (including Build Your Own)
- **Menu item detail modal** — choices (required radio), add-ons (optional checkboxes), quantity counter, special instructions, "Add to Cart"
- **Build Your Own step-by-step wizard** — `BuildYourOwn.jsx` + `BuildYourOwn.css`; 4-step flow (Base → Protein → Toppings → Sauce)
- **Coupon validation at checkout** — `couponsAPI.validate()` called live; discount applied to subtotal
- **Password reset flow** — `/forgot-password` and `/reset-password` pages fully wired
- **Order confirmation page** — real order number from URL param or localStorage; ETA estimate
- **Delivery fee wired to checkout** — debounced call to `POST /api/dispatch/calculate-fee`; distance shown in summary; fee updates total in `buildPayload`
- **Google Maps Places Autocomplete** — dynamic `<script>` loader in `Checkout.jsx`; activates when `VITE_GOOGLE_MAPS_KEY` is set
- **Cart server sync for logged-in users** — `CartContext.jsx` syncs to `POST /api/cart/sync` (debounced 1 s); on mount fetches server cart and merges
- **Email verification on signup** — token generated, verification email sent, `needs_verification: true` returned; `/verify-email` page activates account and auto-logs-in
- **Upsell / cross-sell at checkout** — "Add to Your Order" horizontal scroll row (up to 4 Drinks/Extras items, filtered to exclude cart items)
- Auth: register, login, JWT, `AuthContext` with `isPartner` flag

### ❌ Missing
- None for Phase 1 core ordering flow ✅

---

## Phase 2 — Website: Real-Time Order Tracking

### ✅ Done
- `/order-tracking` page wired: `ordersAPI.track(orderNumber)` fetches by order number
- Socket.IO listener in `OrderTracking.jsx` — handles `order_status_updated` and `driver_location` events
- Backend emits `orderStatusUpdate` to room `order_${id}` on every admin status change
- SMS notification on order place + status change (Twilio `smsService.js`)
- Firebase Cloud Messaging push notifications (`fcmService.js`)
- **DriverView.css** — driver GPS mobile screen fully styled (dark theme, gold accent, badge variants, spinner)
- **`/driver` route** — registered in `habibi-frontend/src/App.jsx` outside Layout (no navbar/footer); accessible via URL param `?id=<driver_id>`
- **Real-time driver notifications** — `DriverView.jsx` connects to Socket.IO on mount, emits `join_driver` to join personal `driver_<id>` room, listens for `assignment_created` and `assignment_status_update` to auto-reload without manual refresh; pulsing green "Live — you'll be notified automatically" indicator shown on waiting screen
- **Live driver tracking map** — Leaflet (CDN, CartoDB Dark Matter tiles); restaurant pin (gold), customer pin (green, Nominatim geocoded), driver pin (🛵, live from Socket.IO `driver_location_update`)
- **ETA from GPS** — Haversine distance driver→customer; updates live
- **Assignment discovery** — `GET /api/dispatch/order/:order_number` public endpoint; tracking page fetches on load for GPS filtering

### ❌ Missing
- None ✅

---

## Phase 3 — Website: Payments

### ✅ Done
- **Authorize.net card payments** *(replaced Stripe — 2026-06-27)* — `AuthNetForm.jsx` loads Accept.js from Authorize.net CDN; card tokenized client-side (PCI compliant, card details never touch our server); opaqueData token sent to `POST /api/payments/authnet/charge`; backend charges via active merchant account credentials
- **Authorize.net multi-account manager** — `authorize_net_accounts` DB table stores multiple VAR sheet credentials; admin CPanel → Payment Accounts page lets admin add/edit/delete/activate accounts; only one account active at a time; switching accounts takes effect instantly with no code change; `GET /api/payments/authnet/config` returns public apiLoginId + clientKey for Accept.js
- **Authorize.net refund** — `POST /api/payments/authnet/refund/:orderNumber` admin endpoint; reads transactionId from order, refunds via active account
- **PayPal server-side capture** — `POST /api/payments/paypal/capture` verifies transaction with PayPal OAuth2 + REST API before marking order paid; frontend no longer calls `actions.order.capture()` directly
- **Zelle / CashApp instructions modal** — `OfflinePayModal.jsx` reads `ZELLE_EMAIL`, `ZELLE_NAME`, `CASHAPP_CASHTAG` from backend `GET /api/payments/offline-info`; shows payment handle + "I've sent the payment" confirm button
- **Square** — real charge via `squareCharge()` with `SQUARE_ACCESS_TOKEN`; mocks when absent
- **Refund handling** — admin `POST /api/admin/payments/:orderNumber/refund` endpoint

### ❌ Removed
- **Stripe** — removed entirely (client uses Authorize.net). `StripeCardForm.jsx` no longer used in checkout. Apple Pay / Google Pay removed (were Stripe-specific). Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`) no longer needed.

### 📋 What's needed to activate Authorize.net
From the VAR sheet, add one account in admin CPanel → Payment Accounts:
- API Login ID
- Transaction Key
- Client Key (merchant portal → Account → Manage Public Client Key)
- Environment: `production` or `sandbox`

### ❌ Missing
- None for core payment flows ✅

---

## Phase 4 — Website: User Account

### ✅ Done
- **Profile update** — `userAPI.updateProfile()` saves name/phone/email
- **Password change** — `userAPI.changePassword()` with current + new password
- **Delete account** — `userAPI.deleteAccount(password)` with GDPR confirmation
- **Order history** — `userAPI.getOrders()` pulls real data including tax, fees, items, delivery address
- **Address CRUD** — add / delete / set-default all wired to `userAPI.*`
- **Saved payment methods** — `savedPaymentsAPI.getAll()` / `setDefault()` / `remove()`
- **Order detail expand** — tapping an order card opens `OrderDetailModal` with full line items table, totals breakdown, delivery address, print receipt (`window.open` monospace HTML) and reorder buttons
- **Re-order button** — "Order Again" calls `addItem()` for each past order item and navigates to `/cart`
- **Loyalty / rewards points** — `loyalty_points INTEGER DEFAULT 0` on `users`; 10 pts per $1 awarded on order placement; displayed in Profile tab with gold progress bar (100 pts = $1 redeemable)

### ❌ Missing
- None ✅

---

## Phase 5 — Admin CPanel

### ✅ Done (all completions)
- Staff Management — CRUD, roles, shift schedules
- Inventory — stock levels, low-stock alerts, restock log
- Location Management — toggle active / accepting orders, edit hours
- Delivery Zones — radius zones per location, fees
- Reports — date-range, 6 report types, CSV export
- Live Order Board — kitchen display, 5 s auto-refresh, fullscreen, Kanban
- **Notification Broadcasts** — SMS (Twilio), Email (SendGrid/SMTP), and **Push (FCM)** channels; audience filters (All / Registered Users / Newsletter Subscribers); sent_count tracked per broadcast
- Coupon usage tracking — actual uses + total saved
- Menu availability toggle — per-item + bulk by category
- Admin audit log — entity_type filter, pagination
- **Business Menu admin UI** — `BusinessMenuAdmin.jsx` at `/wholesale-catalog`; full CRUD for wholesale catalog; tier pricing (tier_1/2/3), min_quantity, unit, image upload; table with thumbnails and active badge
- **Partner order management** — `PartnerOrders.jsx` at `/partner-orders`; status filter tabs with counts; expandable rows with line items, totals, delivery address, notes; inline status dropdown; emails partner on status change

- **Admin panel fully responsive** — `@media` queries added to all 12 admin CSS files: `Customers.css`, `UrgentRequests.css`, `Partners.css`, `MenuBuilder.css`, `Coupons.css`, `Inventory.css`, `Staff.css`, `Careers.css`, `RoadieDeliveries.css`, `Payments.css`, `TableManager.css`, `Locations.css`; side-panel layouts stack to column at ≤768px, form grids collapse to 1-col at ≤600px, modal actions stack at ≤480px

### ❌ Missing
- None ✅

---

## Phase 6 — Partner / Wholesale Portal

### ✅ Done
- Partner login page (`/partner/login`) with dedicated left-panel branding
- Full partner portal (`/partner`) — Catalog / Cart / Orders / Account tabs
- Tier-based pricing (Standard / Silver / Gold) applied from `partner_applications.price_tier`
- Bulk order cart with min_quantity enforcement, persisted to localStorage
- Printable invoice modal (`window.print()`)
- `AuthContext.isPartner` flag; `App.jsx` routes `/partner` and `/partner/login`; both fullscreen (no Navbar)
- `Wholesale.jsx` "Already a partner? Sign in →" CTA
- Backend: `partnerPortalController`, `partnerPortalRoutes`, `partnerMiddleware`
- DB: `business_menus` and `partner_orders` tables
- **Partner email notifications** — `sendPartnerOrderUpdate()` fires on every status change (confirmed / processing / shipped / delivered / cancelled); dark partner-branded HTML template (`wrapPartnerTemplate`)
- **Partner password reset** — `forgotPassword` branches on `is_partner`; partner accounts receive `sendPartnerPasswordReset()` with dark-themed portal-branded email; standard accounts receive `sendPasswordReset()`

### 🔶 Partial
- **EIN / certificate validation** — admin can view uploaded certificate; approval is manual; no OCR or EIN format check

### ❌ Missing
- None for partner portal core flow ✅

---

## Phase 7 — Delivery Platform Integrations

### ✅ Done
- **DoorDash Drive API** — JWT auth (`doordash.js` util), auto-dispatch on every delivery order, webhook for status updates (`/api/doordash/webhook`), admin list/cancel/manual-dispatch
- **Roadie long-distance API** — Bearer token auth (`roadie.js` util), auto-dispatch for 10+ mile orders, webhook for state updates (`/api/roadie/webhook`), admin list/cancel/manual-dispatch/estimate; `roadie_deliveries` table
- **Distance-based dispatch router** — Google Maps distance → ≤3 mi in-house, 3–10 mi DoorDash Drive, 10+ mi Roadie; both providers simulated when `*=SIMULATED`
- **Uber Eats webhook** — receives orders at `/api/marketplace/webhook/ubereats`, normalises to `marketplace_orders`, emits Socket.IO event
- **GrubHub webhook** — `/api/marketplace/webhook/grubhub`, same normalisation
- **Caviar webhook** — `/api/marketplace/webhook/caviar` (DoorDash-backed format)
- **In-house dispatch** — assign driver, GPS update via PATCH, Socket.IO live coordinates relay, admin DeliveryDispatch page, mark delivered
- **Driver assignment notification** — `dispatchController.assignDriver` fetches driver's phone, emits `assignment_created` to targeted `driver_<id>` Socket.IO room (not broadcast), and fires SMS via `smsService.sendSMS()` with order number + address + deep link (`/driver?id=<id>`); SMS fires in background and fails silently if Twilio not configured
- **Socket.IO `join_driver` event** — `socket/index.js` validates and joins driver to `driver_<id>` room; driver page emits this on connect so targeted assignment events work
- **Distance Matrix** — `POST /api/dispatch/calculate-fee` calls Google Maps API, returns distance + tiered fee; admin fee calculator widget
- **Admin pages** — DeliveryDispatch (in-house + DoorDash tabs, GPS live dot, fee calc) and MarketplaceOrders (UberEats / GrubHub / Caviar tabs, accept/decline, webhook guide)
- **DriverView.css** — mobile-first dark theme created (see Phase 2)
- **`/driver` route** — registered in frontend `App.jsx` (see Phase 2)
- **Checkout delivery fee** — wired to `POST /api/dispatch/calculate-fee` with 800 ms debounce on address change (see Phase 3)

### 🔶 Platform-gated (cannot implement without partner API access)
- **UberEats menu sync (push)** — requires UberEats Restaurant Manager API with separate OAuth scope; platform-gated
- **GrubHub menu sync** — requires GrubHub partner-level API access; platform-gated

### ❌ Missing
- None for implementable delivery features ✅

---

## Phase 8 — Notifications & Communication

### ✅ Done
- **Twilio SMS** — `smsService.js` sends order confirmation + status updates + **driver assignment alerts** (order number, drop-off address, deep link); env vars `TWILIO_*`
- **Email** — `emailService.js` sends order confirmation, status update, welcome, password reset, email verification, partner order update, partner password reset
- **Firebase Cloud Messaging** — `fcmService.js` sends push on order placed + status change + broadcast
- All three fire automatically from `createGuestOrder` and `updateGuestOrderStatus`
- **In-app notification inbox** — `user_notifications` table, `GET/PATCH /api/users/me/notifications` routes, order lifecycle hooks in `createGuestOrder` + `updateGuestOrderStatus`, mobile HomeScreen bell with badge, full NotificationsScreen
- **Branded HTML email templates** — `wrapHtmlTemplate` (navy `#0f172a` header, gold `#d97706` border, item tables, CTA buttons, tracking links); `wrapPartnerTemplate` (dark `#141414` bg, gold accent, partner portal branding)
- **Welcome email on registration** — `sendSignupWelcome()` called from `verifyEmail` in `authController.js` after email is confirmed
- **Password reset templates** — `sendPasswordReset` (standard branded) and `sendPartnerPasswordReset` (dark partner-branded) both fully templated
- **Newsletter email broadcasts** — `broadcastsController` queries `newsletter_subscribers` filtered by `is_subscribed = TRUE`; passes `{ email, unsubscribeToken }` objects to `sendNewsletter`; each email gets a personalised one-click unsubscribe footer link
- **Unsubscribe / opt-out** — `is_subscribed BOOLEAN DEFAULT TRUE` and `unsubscribe_token VARCHAR(64)` on `newsletter_subscribers`; `GET /api/contact/unsubscribe?token=xxx` renders a self-contained HTML confirmation page; existing rows backfilled with `gen_random_uuid()`
- **SMS STOP webhook** — `POST /api/contact/sms-optout` handles Twilio STOP callbacks; sets `users.receive_sms_updates = FALSE` by E.164 phone match
- **Mailchimp / SendGrid list sync** — `syncNewsletterContact()` tries Mailchimp API then SendGrid Marketing Contacts API on every new subscriber; gracefully no-ops when credentials absent
- **FCM broadcast channel** — Broadcasts page supports Push channel; loops `user_device_tokens` up to 2000 tokens

### ❌ Missing
- None ✅

---

## Phase 9 — SEO & Marketing

### ✅ Done
- **Google Analytics 4** — `initGA()` in `App.jsx`; page views tracked; **`trackAddToCart`** fires on every `addItem()` call; **`trackBeginCheckout`** fires on card/offline checkout start; **`trackPurchase`** fires on `OrderConfirmation` mount (order snapshot saved to localStorage before cart clear)
- **Facebook Pixel** — `initPixel()` in `App.jsx`; **`AddToCart`**, **`InitiateCheckout`**, **`Purchase`** events fire alongside GA4 counterparts
- **Per-page meta / OG tags** — `SEO.jsx` component sets `<title>`, `<meta description>`, `og:title/description/image/url/type`, `twitter:card/title/description/image` on every page mount; used by Home, Menu, Locations, About, Contact pages
- **JSON-LD structured data** — `restaurantSchema` (Restaurant + LocalBusiness + hours + `sameAs` social links) injected via `SEO.jsx` on Home page
- **Canonical URLs** — `SEO.jsx` injects `<link rel="canonical">` using `url` prop or `window.location.href` (query-string stripped) as fallback
- **robots.txt** — `GET /robots.txt` via `seoController.getRobotsTxt`; disallows `/api/`, `/admin/`, `/checkout`, `/account`, auth pages; includes Sitemap reference
- **sitemap.xml** — `GET /sitemap.xml`; static pages + dynamic location + menu item entries with `lastmod`, `changefreq`, `priority`
- **Social media links** — Footer: real `facebook.com/habibihalalexpress`, `instagram.com/habibihalalexpress`, `youtube.com/habibihalalexpress` anchors with brand SVG icons
- **Google Business "Order Online"** — Footer: "Order on Google" badge linking to `maps.google.com/?q=Habibi+Halal+Express+Bronx`

### ❌ Missing
- None ✅

---

## Phase 10 — Mobile Apps

### ✅ 10a — Customer App (Android + iOS) — Feature Complete
All 19 feature gaps resolved. See `CUSTOMER_MOBILE_APP.md` for full list.
- Home feed, menu browse + search, item detail with choices/add-ons
- Cart + checkout (delivery, pickup, dine-in) — `delivery_method` and `table_number` fixed end-to-end
- Real-time order tracking with live driver GPS map
- Account: profile, addresses, order history, saved payment methods, photo upload
- Loyalty points (earn on order, redeem at checkout)
- Push notifications (device token registered on login, FCM wired on backend)
- In-app notification bell + inbox (`user_notifications` table, `NotificationsScreen`)
- Driver chat (WebSocket + DB persistence)
- Offers screen, dine-in QR flow, voice search
- 5 production blockers remain — all require external accounts (EAS, Google Maps, Stripe, Firebase, APNs)

#### 10b — Merchant Tablet App (Habibi Merchant)
- Login with merchant credentials
- Live order board (incoming → preparing → ready → delivered)
- Accept / reject orders with one tap
- Print receipt (Bluetooth thermal printer)
- End-of-day sales summary
- Item availability toggle (mark sold out)

#### 10c — Business Wholesale App (Android + iOS)
- Partner login (same credentials as web portal)
- Browse business catalog at tier prices
- Bulk order cart
- Order history + invoices
- Request custom quote
- Account management

> **Recommended stack:** React Native (Expo) — shares component logic with web; FCM and deep links already configured on backend.

---

## Phase 11 — Infrastructure & DevOps

### ✅ Done (Security & Observability)
- **Helmet.js** — installed + `app.use(helmet())` as first middleware; sets 14 HTTP security headers
- **Rate limiting** — `express-rate-limit` applied: auth routes (20 req/15 min), payment routes (10 req/min)
- **CORS origin allowlist** — `app.use(cors({ origin: allowedOrigins }))` reads `CORS_ORIGINS` env var
- **Morgan HTTP logging** — `app.use(morgan(...))` logs every request; `combined` in production, `dev` in dev
- **Winston structured logger** — `src/config/logger.js` with JSON format, timestamps, file rotation (`logs/error.log`, `logs/combined.log`)
- **Health check endpoint** — `GET /health` pings DB and returns `{ status, db, uptime }`; suitable for Railway/Render/UptimeRobot
- **Route auth — locations CRUD** — `POST/PUT/DELETE /api/locations` now require `protect + admin` middleware; `GET` stays public (`locationRoutes.js`)
- **Route auth — delivery** — `POST /api/delivery/assign` and `PUT /api/delivery/status` require `protect + admin`; `PUT /api/delivery/location` requires `protect` (`deliveryRoutes.js`)
- **Route auth — AI recommendations** — `optionalAuth` middleware added; `email` is derived from JWT only, never from query string; unauthenticated callers get popular results, no order history leak (`aiController.js`)
- **Route auth — AI chat/stats** — `POST /api/ai/chat` and `GET /api/ai/stats` now require `protect + admin` (`aiRoutes.js`)
- **Socket.IO JWT auth** — `io.use()` optional JWT middleware sets `socket.data.user`; `update_location` events blocked unless `role: driver|admin`; frontend + admin both pass JWT in handshake `auth.token` (`socket/index.js`, `OrderTracking.jsx`, `Driver.jsx`)
- **Firebase service worker** — `habibi-frontend/public/firebase-messaging-sw.js` created; enables background push notifications when tab is closed; fill Firebase config values before deploy
- **CI/CD pipeline** — `.github/workflows/deploy.yml` created; runs backend syntax check + frontend Vite build + admin Vite build on every push/PR to `main`
- **Cloudinary image CDN** — `uploadMiddleware.js` auto-detects `CLOUDINARY_*` env vars; uses Cloudinary in production (with 800px resize + auto quality), local disk fallback in dev; `cloudinary` + `multer-storage-cloudinary` installed
- **Security hardening (30 vulnerabilities fixed)** — coupon routes admin-locked; negative discount/quantity rejected; order total/item validation; adminMiddleware merchant-role removed; loyalty points atomic transaction; Stripe webhook bypass removed; HTTPS redirect; frameguard; multer error handler; rate limiters active in all envs; file upload MIME+extension whitelist; finance/logistics routes admin-locked; public tracking PII redacted; password hash randomised on delete; reset token not leaked in API response; audit log wired to menu/coupon/order actions
- **Audit log wired** — `logAudit()` called on `create/update/delete_menu_item`, `create/delete_coupon`, `update_order_status`
- **Customer features** — loyalty redemption at checkout, review submission on OrderConfirmation, favorites (heart button + Account tab), Account notifications tab, navbar notification bell with unread badge
- **Legal pages** — `/health-safety`, `/privacy-policy`, `/terms` — all footer links now live
- **Order history** — `user_id` column on `guest_orders`; orders matched by user_id OR email (case-insensitive) OR phone; checkout pre-fills email/name/phone from profile
- **Location images** — `image_url` column on `locations`; correct map screenshots seeded per location; admin can update via edit modal
- **Open/Closed live badge** — computed from `working_days_hours` string at runtime, not just `is_active`
- **404 page** — `/NotFound.jsx` replaces catch-all redirect
- **Social login removed** — Google/Apple buttons are decorative; can be activated with free Google Cloud OAuth Client ID when client requests it

### 🔶 Partial
- **Environment config** — `.env` has 60+ vars; real keys partially filled; `.env.production` not present; no secrets manager (Vault / AWS SSM)
- **Admin MFA (email OTP)** — code is fully built and live on server. Automatically activates once `SENDGRID_API_KEY` or `SMTP_HOST`+`SMTP_USER`+`SMTP_PASS` are added to `.env` and PM2 is restarted. Currently bypassed because SMTP is not configured — admin logs in with password only. See Phase 12a (Email / SendGrid) for setup steps.

### ✅ Input Validation
- **express-validator** installed and wired — schemas on auth (register/login/forgot/reset), orders (guest), coupons (validate/create), users (profile/password/addresses), reviews, reservations (catering), urgent requests
- Shared `validate.js` middleware with reusable field rules (`rules.email`, `rules.password`, `rules.rating`, etc.)
- All validation errors return `422 { message, errors: [{ field, message }] }` consistently

### ❌ Missing

#### Launch blockers (infrastructure — require external accounts)
- **Production hosting** — backend needs Railway / Render / DigitalOcean App Platform / Fly.io
- **PostgreSQL cloud DB** — currently localhost; needs Supabase, Neon, or RDS before any live traffic
- **HTTPS / SSL** — provided automatically by Railway/Render/Vercel once deployed
- **Stripe webhook secret** — `STRIPE_WEBHOOK_SECRET` is a placeholder; must be set from Stripe CLI/dashboard in production

#### Data
- **Automated DB backup** — no cron backup or cloud backup configured; data loss risk if cloud DB crashes

#### CI/CD
- **Environment parity** — no staging environment; all testing done on local/dev

---

## Immediate Action Items Before Launch

| Priority | Item | Effort | Phase | Status |
|---|---|---|---|---|
| 🔴 Critical | Cloud PostgreSQL (Supabase/Neon) | XS | 11 | ❌ Need account |
| 🔴 Critical | Production hosting (Railway/Render) | Small | 11 | ❌ Need account |
| 🔴 Critical | HTTPS / SSL certificate | XS | 11 | ❌ Auto via host |
| 🔴 Critical | Set `STRIPE_WEBHOOK_SECRET` from Stripe CLI | XS | 3 | ❌ Need account |
| 🔴 High | Helmet.js + CORS origin allowlist | XS | 11 | ✅ Done |
| 🟡 Medium | Structured logging (Winston) | Small | 11 | ✅ Done (`logger.js`) |
| 🟡 Medium | Error monitoring (Sentry) | XS | 11 | ❌ Need account |
| 🟡 Medium | Health check endpoint `GET /health` | XS | 11 | ✅ Done |
| 🟡 Medium | Morgan HTTP request logging | XS | 11 | ✅ Done |
| 🟡 Medium | Rate limiting on auth + payment routes | XS | 11 | ✅ Done |
| 🟡 Medium | Image CDN (Cloudinary) | Medium | 11 | ✅ Code wired — set `CLOUDINARY_*` env vars to activate |
| 🟡 Medium | CI/CD (GitHub Actions) | Medium | 11 | ✅ Done (`.github/workflows/deploy.yml`) |
| 🟡 Medium | Route auth on locations / delivery / AI / Socket.IO | Small | 11 | ✅ Done |
| 🟡 Medium | Firebase background push service worker | XS | 8 | ✅ Done — fill config values before deploy |
| 🟡 Medium | DB backup cron | Small | 11 | ❌ Need cloud DB first |
| 🟢 Low | EIN / certificate OCR validation (partner portal) | High | 6 | ❌ Not started |
| 🟢 Low | Merchant Tablet App (React Native / Expo) | Very High | 10b | 🔶 Started — screens exist, needs testing |
| 🟢 Low | Business Wholesale App (React Native / Expo) | Very High | 10c | 🔶 Started — screens exist, needs testing |
| 🟢 Low | UberEats / GrubHub menu push sync | High | 7 | ❌ Platform-gated |

---

## Completion Summary by Phase

| Phase | Description | Status |
|---|---|---|
| 1 | Menu & Ordering | ✅ Complete |
| 2 | Real-Time Tracking | ✅ Complete |
| 3 | Payments | ✅ Complete |
| 4 | User Account | ✅ Complete |
| 5 | Admin CPanel | ✅ Complete |
| 6 | Partner / Wholesale Portal | ✅ Complete |
| 7 | Delivery Integrations | ✅ Complete (DoorDash Drive + Roadie + distance routing; platform-gated items excluded) |
| 8 | Notifications & Communication | ✅ Complete (SMS + Email + FCM push + in-app notification inbox) |
| 9 | SEO & Marketing | ✅ Complete |
| 10a | Customer Mobile App | ✅ Feature-complete — 5 production blockers need external accounts |
| 10b | Merchant Tablet App | 🔶 Started — screens exist, needs full testing |
| 10c | Business Wholesale App | 🔶 Started — screens exist, needs full testing |
| 11 | Infrastructure & DevOps | 🔶 Security hardening + CI/CD + Cloudinary + route auth + Firebase SW done — cloud hosting/DB/API keys need external accounts |

---

---

## Phase 12 — Production Readiness

> Everything below must be completed before accepting real orders from real customers.
> **Status key:** ✅ Configured · 🔶 Partial / mock value · ❌ Not set

---

### 12a — API Keys & Third-Party Services

#### 🔴 Payments — Required (app cannot take money without these)

| Service | Backend `.env` var | Frontend `.env` var | Where to Get | Current State | Cost |
|---|---|---|---|---|---|
| **Stripe Secret Key** | `STRIPE_SECRET_KEY` | — | dashboard.stripe.com → Developers → API Keys | 🔶 `sk_test_REPLACE_ME` | 2.9% + 30¢/txn |
| **Stripe Webhook Secret** | `STRIPE_WEBHOOK_SECRET` | — | Stripe Dashboard → Webhooks → add endpoint → signing secret | 🔶 `whsec_REPLACE_ME` | Free |
| **Stripe Publishable Key** | — | `VITE_STRIPE_PUBLISHABLE_KEY` | Same dashboard — starts `pk_live_` | 🔶 `pk_test_REPLACE_ME` | Free |
| **PayPal Client ID** | `PAYPAL_CLIENT_ID` | `VITE_PAYPAL_CLIENT_ID` | developer.paypal.com → My Apps → Create App | 🔶 `REPLACE_ME` | 3.49% + fixed fee |
| **PayPal Client Secret** | `PAYPAL_CLIENT_SECRET` | — | Same app page | 🔶 `REPLACE_ME` | Free |
| **PayPal Mode** | `PAYPAL_MODE` | — | Set to `production` for live | 🔶 `sandbox` | — |

> **Stripe webhook setup:** In production, go to Stripe Dashboard → Developers → Webhooks → Add endpoint → URL: `https://yourbackend.com/api/webhooks/stripe` → select events: `payment_intent.succeeded`, `payment_intent.payment_failed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

---

#### 🔴 SMS — Twilio (Required for order confirmation texts)

| Env Var | Where to Get | Current State | Cost |
|---|---|---|---|
| `TWILIO_ACCOUNT_SID` | console.twilio.com → Account Info | ❌ Empty | Free trial ~$15 credit |
| `TWILIO_AUTH_TOKEN` | Same page | ❌ Empty | Free |
| `TWILIO_PHONE_NUMBER` | Twilio console → Phone Numbers → Buy | ❌ Empty | ~$1/month; format: `+17185550100` |

> **STOP webhook:** In Twilio console → Messaging → Sender Info → Phone Number → set **Inbound webhook** to `POST https://yourbackend.com/api/contact/sms-optout` — this fires when a customer replies STOP and updates `users.receive_sms_updates = FALSE`.

---

#### 🔴 Email — SendGrid (Required for order receipts, welcome email, password reset)

| Env Var | Where to Get | Current State | Cost |
|---|---|---|---|
| `SENDGRID_API_KEY` | app.sendgrid.com → Settings → API Keys → Create | ❌ Empty | Free: 100 emails/day |
| `EMAIL_FROM` | Your value — must match a verified sender | 🔶 `noreply@habibihalal.com` | Free |
| `SENDGRID_MARKETING_LIST_ID` | SendGrid → Marketing → Contacts → Lists | ❌ Empty | Free tier available |

> **Domain authentication required:** In SendGrid → Settings → Sender Authentication → Authenticate a domain → add the DNS records to your domain registrar. Without this, emails land in spam or are rejected.

---

#### 🔴 Google Maps (Required for delivery fee calculation + address autocomplete)

| Env Var | Where to Get | Current State | Cost |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` (backend) | console.cloud.google.com → APIs & Services → Credentials → Create API Key | 🔶 `SIMULATED` | ~$200 free/month; then pay-per-use |
| `VITE_GOOGLE_MAPS_KEY` (frontend) | Same key, or a browser-restricted copy | ❌ Not set | Free quota usually covers small restaurants |

> **APIs to enable** in the Google Cloud console for this project:
> - **Distance Matrix API** — delivery fee calculation (`/api/dispatch/calculate-fee`)
> - **Places API** — address autocomplete in Checkout
> - **Geocoding API** — converts address text to lat/lng for driver map
>
> **Restrict the browser key:** In the console, add HTTP referrer restrictions (`https://yoursite.com/*`) so it cannot be abused if exposed in frontend code.

---

#### 🟡 Firebase Cloud Messaging (Required for push notifications)

| Env Var | Where to Get | Current State | Cost |
|---|---|---|---|
| `FCM_SERVER_KEY` | console.firebase.google.com → Project Settings → Cloud Messaging → Server key | ❌ Empty | Free for all volume |
| `FCM_PROJECT_ID` | Same page | ❌ Empty | Free |

> **Frontend also needs Firebase config.** Create `habibi-frontend/public/firebase-messaging-sw.js`:
> ```js
> importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
> importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');
> firebase.initializeApp({ apiKey:'...', projectId:'...', messagingSenderId:'...', appId:'...' });
> firebase.messaging().onBackgroundMessage(payload => {
>   self.registration.showNotification(payload.notification.title, { body: payload.notification.body });
> });
> ```
> Without this service worker, push notifications only work while the tab is open.

---

#### 🟡 DoorDash Drive (Required for auto-dispatch; currently simulated)

| Env Var | Where to Get | Current State | Cost |
|---|---|---|---|
| `DOORDASH_DEVELOPER_ID` | developer.doordash.com → Create App | 🔶 `SIMULATED` | Sandbox free; production needs business account |
| `DOORDASH_KEY_ID` | DoorDash developer portal → API Keys | ❌ Not set | Free |
| `DOORDASH_SIGNING_SECRET` | Same page | ❌ Not set | Free |

> Without real keys, `doordash.js` logs mock dispatch to console. No actual driver is dispatched.

---

#### 🟢 Marketing & Analytics (Recommended, not launch-blocking)

| Service | Env Var | Where to Get | Current State | Cost |
|---|---|---|---|---|
| **Google Analytics 4** | `VITE_GA_MEASUREMENT_ID` | analytics.google.com → Admin → Data Streams → Web stream | 🔶 `G-MOCKTRACKER` | Free |
| **Facebook Pixel** | `VITE_FB_PIXEL_ID` | business.facebook.com → Events Manager → Connect Data Sources → Web | 🔶 `123456789012345` | Free |
| **Mailchimp** | `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID` | mailchimp.com → Account → Extras → API Keys | ❌ Empty | Free ≤500 contacts |

---

#### 🟢 Optional Services (nice-to-have)

| Service | Env Var | Purpose | Cost |
|---|---|---|---|
| **OpenAI** | `OPENAI_API_KEY` | Powers `/api/ai` routes (if used) | Pay-per-token; gpt-4o-mini is cheapest |
| **Square** | `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY` | Alternative to Stripe; set `PAYMENT_PROCESSOR=square` | 2.6% + 10¢ in-person |
| **Sentry** | `SENTRY_DSN` | Error monitoring — catches unhandled exceptions | Free ≤5k errors/month |

---

### 12b — npm Packages to Install

These packages are needed but **not currently in `habibi-backend/package.json`**:

```bash
cd habibi-backend
npm install helmet winston morgan @sentry/node express-validator
```

| Package | Why Needed | One-line Usage |
|---|---|---|
| `helmet` | Sets 14 HTTP security headers (HSTS, CSP, X-Frame-Options) | `app.use(helmet())` before all routes |
| `winston` | Structured JSON logging with levels, timestamps, file rotation | Replace `console.error` calls across controllers |
| `morgan` | Logs every HTTP request (method, path, status code, response time) | `app.use(morgan('combined'))` |
| `@sentry/node` | Captures uncaught errors + slow transactions; sends alerts | `Sentry.init({ dsn: process.env.SENTRY_DSN })` |
| `express-validator` | Validates + sanitises `req.body` fields (email format, required, length) | Middleware on auth + order routes |

> `express-rate-limit` is already in `package.json` but **not applied in `app.js`**. See code changes below.

---

### 12c — Code Changes Required ✅ ALL DONE

#### 1. Add Helmet security headers — `habibi-backend/src/app.js` ✅

```js
const helmet = require('helmet');
app.use(helmet());   // Add as the very first middleware, before cors()
```

#### 2. Apply rate limiting to auth + payment routes — `habibi-backend/src/app.js`

```js
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many attempts, try again in 15 minutes.' } });
const payLimiter  = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many payment requests.' } });

app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/payments', payLimiter,  paymentRoutes);
```

#### 3. Add health check endpoint — `habibi-backend/src/app.js`

```js
const pool = require('./config/db');
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', uptime: Math.floor(process.uptime()) + 's' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: e.message });
  }
});
```

Uptime monitors (UptimeRobot, Render, Railway) ping this URL every minute. If DB goes down you get an alert.

#### 4. Add Winston logger — new file `habibi-backend/src/config/logger.js`

```js
const winston = require('winston');
module.exports = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

Then in controllers replace `console.error('...')` with `logger.error('...')`.

#### 5. Add Sentry error monitoring — `habibi-backend/src/app.js`

```js
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
app.use(Sentry.Handlers.requestHandler());   // Must be first middleware
// ... all routes ...
app.use(Sentry.Handlers.errorHandler());     // Must be last middleware, before custom error handler
```

#### 6. Add Morgan HTTP request logging — `habibi-backend/src/app.js`

```js
const morgan = require('morgan');
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
```

#### 7. Move `CORS_ORIGINS` to include production domains

Update `.env`:
```
CORS_ORIGINS=https://habibihalal.com,https://admin.habibihalal.com,https://www.habibihalal.com
```

The CORS code in `app.js` already reads this variable — no code change needed.

#### 8. Switch to Cloudinary for image uploads — `habibi-backend/src/middleware/uploadMiddleware.js`

```bash
npm install cloudinary multer-storage-cloudinary
```

```js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = new CloudinaryStorage({ cloudinary, params: { folder: 'habibi-menu', allowed_formats: ['jpg','jpeg','png','webp'] } });
module.exports = multer({ storage });
```

Without this, every new deploy on Railway/Render **wipes all uploaded images**.

---

### 12d — Infrastructure Setup

#### Step 1 — PostgreSQL Cloud Database (Supabase — Recommended)

1. Create free account at **supabase.com**
2. New Project → choose region closest to your users (e.g. US East)
3. Copy the **connection string** from Settings → Database → Connection String → URI
4. Update `habibi-backend/.env`:
```
DB_HOST=db.xxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<supabase-db-password>
```
5. On first backend start, `src/config/init.js` auto-creates all tables
6. **Automatic backups** are included free on Supabase (7-day point-in-time recovery on Pro, daily on Free)

**Alternatives:** Neon.tech (generous free tier, serverless), Railway PostgreSQL add-on ($5/mo), AWS RDS

---

#### Step 2 — Backend Hosting (Railway — Recommended)

1. Push `habibi-backend/` to a GitHub repo
2. railway.app → New Project → Deploy from GitHub → select the repo
3. Set **Start Command**: `node server.js`
4. Add all env vars from `habibi-backend/.env` in Railway's Variables tab
5. Railway auto-assigns a public HTTPS URL, e.g. `https://habibi-backend.railway.app`
6. SSL is included automatically — no configuration needed

**Cost:** ~$5/month (Hobby plan, 512 MB RAM, 1 vCPU)  
**Alternatives:** Render.com (free tier but sleeps after 15 min inactivity), Fly.io, DigitalOcean App Platform (~$12/mo)

---

#### Step 3 — Frontend Hosting (Vercel — Recommended)

1. Push `habibi-frontend/` to GitHub (can be same repo, monorepo, or separate)
2. vercel.com → Import Project → select repo → set **Root Directory** to `habibi-frontend`
3. Framework: Vite is auto-detected
4. Add environment variables in Vercel dashboard:
   - `VITE_API_URL` = `https://habibi-backend.railway.app` (your Railway URL)
   - All other `VITE_*` keys
5. Vercel auto-deploys on every push to `main`. Preview URLs generated for PRs.

**Cost:** Free (Hobby plan covers most small restaurants)  
**Admin panel** (`habibi-admin/`): deploy separately as a second Vercel project

---

#### Step 4 — Custom Domain + SSL

1. Buy domain (or use existing `habibihalal.com`) at Namecheap/Cloudflare
2. In Vercel: Settings → Domains → Add → `habibihalal.com` → follow DNS instructions
3. In Railway: Settings → Networking → Custom Domain → `api.habibihalal.com` → add CNAME record
4. SSL certificates are provisioned automatically by both platforms (Let's Encrypt)

> **Result:** `habibihalal.com` (frontend) + `api.habibihalal.com` (backend) — both HTTPS, no manual certificate management.

---

#### Step 5 — Image CDN (Cloudinary)

1. Free account at **cloudinary.com** (25 GB storage, 25 GB bandwidth/month free)
2. Dashboard → Settings → Access Keys → copy Cloud Name, API Key, API Secret
3. Add to `habibi-backend/.env`:
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=xxxxxxxxxxxx
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxx
```
4. Update `uploadMiddleware.js` (see code change #8 above)

---

#### Step 6 — CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml` in your repo:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  lint-backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: habibi-backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint

  lint-frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: habibi-frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build   # Catches type errors + broken imports at build time
```

Railway and Vercel both auto-deploy on push to `main` via their GitHub integrations — the Actions workflow just adds lint/build checks before the deploy triggers.

---

### 12e — Complete Production `.env` Reference

Copy this into `habibi-backend/.env` and fill in each value. Lines marked `# REQUIRED` will break functionality if left empty.

```env
# ── Server ─────────────────────────────────────────────────────────────────
PORT=5001
NODE_ENV=production                                    # REQUIRED — enables prod error handling
JWT_SECRET=<run: openssl rand -hex 32>                 # REQUIRED — 64-char random string
FRONTEND_URL=https://habibihalal.com                   # REQUIRED — used in email links
CORS_ORIGINS=https://habibihalal.com,https://admin.habibihalal.com   # REQUIRED

# ── Database ────────────────────────────────────────────────────────────────
DB_HOST=db.xxxx.supabase.co                            # REQUIRED
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<supabase-password>                        # REQUIRED
LOG_LEVEL=info

# ── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_xxxx                         # REQUIRED for card payments
STRIPE_WEBHOOK_SECRET=whsec_xxxx                       # REQUIRED — from Stripe Dashboard → Webhooks

# ── PayPal ──────────────────────────────────────────────────────────────────
PAYPAL_CLIENT_ID=xxxx                                  # REQUIRED for PayPal button
PAYPAL_CLIENT_SECRET=xxxx                              # REQUIRED
PAYPAL_MODE=production                                 # REQUIRED — change from "sandbox"

# ── Square (optional alternative to Stripe) ─────────────────────────────────
PAYMENT_PROCESSOR=stripe                               # Change to "square" to swap
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
SQUARE_WEBHOOK_SIGNATURE_KEY=

# ── Offline payment display ─────────────────────────────────────────────────
ZELLE_EMAIL=payments@habibihalal.com
ZELLE_NAME=Habibi Halal Express
CASHAPP_CASHTAG=$HabibiHalal

# ── Twilio SMS ──────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxx                              # REQUIRED for SMS confirmations
TWILIO_AUTH_TOKEN=xxxx                                 # REQUIRED
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx                       # REQUIRED — E.164 format

# ── Email ───────────────────────────────────────────────────────────────────
SENDGRID_API_KEY=SG.xxxx                               # REQUIRED for all emails
EMAIL_FROM=orders@habibihalal.com                      # REQUIRED — must be verified in SendGrid
SENDGRID_MARKETING_LIST_ID=                            # Optional — newsletter list sync

# ── Mailchimp (alternative newsletter sync) ─────────────────────────────────
MAILCHIMP_API_KEY=                                     # Optional — format: key-us20
MAILCHIMP_LIST_ID=                                     # Optional

# ── Firebase Cloud Messaging ────────────────────────────────────────────────
FCM_SERVER_KEY=AAAAxxxx                                # REQUIRED for push notifications
FCM_PROJECT_ID=habibi-xxxx                             # REQUIRED

# ── Google Maps ─────────────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=AIzaxxxx                           # REQUIRED for delivery fee calc
# Enable in Google Cloud: Distance Matrix API, Places API, Geocoding API

# ── DoorDash Drive ──────────────────────────────────────────────────────────
DOORDASH_DEVELOPER_ID=xxxx                             # REQUIRED for auto-dispatch
DOORDASH_KEY_ID=xxxx
DOORDASH_SIGNING_SECRET=xxxx

# ── Cloudinary image CDN ────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=                                 # REQUIRED if using Cloudinary storage
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── Error Monitoring ────────────────────────────────────────────────────────
SENTRY_DSN=https://xxxx@sentry.io/xxxx                 # Recommended — free tier available
```

Copy this into `habibi-frontend/.env` (for Vercel, add these as Environment Variables in the dashboard):

```env
VITE_API_URL=https://api.habibihalal.com               # REQUIRED — your Railway backend URL
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxx               # REQUIRED for Stripe Payment Element
VITE_PAYPAL_CLIENT_ID=xxxx                             # REQUIRED for PayPal button
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX                    # Recommended — format: G-XXXXXXXXXX
VITE_FB_PIXEL_ID=xxxxxxxxxxxxxxx                       # Recommended — 15-digit number
VITE_GOOGLE_MAPS_KEY=AIzaxxxx                          # REQUIRED for address autocomplete
VITE_SITE_URL=https://habibihalal.com                  # Used for canonical URLs in SEO component
```

---

### 12f — Go-Live Checklist (in order)

| # | Step | Blocker? | Est. Time |
|---|---|---|---|
| 1 | Create Supabase project + update `DB_*` env vars | ✅ Yes — nothing works without DB | 10 min |
| 2 | Deploy backend to Railway + add all env vars | ✅ Yes | 20 min |
| 3 | Deploy frontend to Vercel + set `VITE_API_URL` | ✅ Yes | 10 min |
| 4 | Deploy admin panel to Vercel as second project | ✅ Yes | 10 min |
| 5 | Add custom domains + update DNS records | ✅ Yes | 30 min + DNS propagation |
| 6 | Get Stripe **live** keys + add webhook endpoint in dashboard | ✅ Yes — no real payments without | 15 min |
| 7 | Verify sender domain in SendGrid (DNS records) | ✅ Yes — emails go to spam without | 30 min + DNS |
| 7a | Add `SENDGRID_API_KEY` to `.env` + `pm2 restart habibi-backend` | No — but activates admin MFA automatically | 2 min |
| 8 | Buy Twilio phone number + add `TWILIO_*` credentials | No — SMS optional at launch | 10 min |
| 9 | Enable Google Maps APIs + add `GOOGLE_MAPS_API_KEY` | No — fee defaults to $0 without it | 15 min |
| 10 | `npm install helmet winston morgan` + apply in `app.js` | No — but a security risk without | 10 min |
| 11 | Set up Sentry project + add `SENTRY_DSN` | No — but flying blind in production | 10 min |
| 12 | Switch to Cloudinary for image uploads | No — but images lost on redeploy without | 1–2 hrs |
| 13 | Set up Firebase + add `FCM_*` + service worker | No — push notifications only | 30 min |
| 14 | Add real GA4 + Pixel IDs to replace mock values | No — analytics only | 5 min |
| 15 | Apply rate limiting in `app.js` (already installed) | No — security hardening | 10 min |
| 16 | Add `GET /health` endpoint | No — needed for uptime monitors | 5 min |
| 17 | Set up UptimeRobot to ping `/health` every 5 min | No — free alerting | 5 min |

> **Minimum to accept first real order:** Steps 1–7 (approximately 2–3 hours including DNS propagation wait).  
> **Estimated monthly cost at launch:** ~$10–20/month (Railway $5, Supabase free, Twilio per-message, Stripe per-transaction, Vercel free, SendGrid free tier).
