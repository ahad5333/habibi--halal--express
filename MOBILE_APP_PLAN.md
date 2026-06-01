# Habibi Halal Express — Mobile App Plan (React Native / Expo)

> Customer-facing app for Android + iOS. Shares the existing Express backend at port 5001.  
> Framework: **Expo (Managed Workflow)** · Navigation: **React Navigation v7** · Styling: **React Native StyleSheet + NativeWind**

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Expo SDK 52 (managed) | Zero native config, OTA updates, EAS Build for store |
| Navigation | React Navigation v7 (Stack + Bottom Tabs) | Industry standard, well-typed |
| HTTP | Axios | Interceptors for auth token injection |
| Real-time | socket.io-client | Same backend Socket.IO server |
| Payments | `@stripe/stripe-react-native` | Native Stripe Payment Sheet |
| Storage | `expo-secure-store` | Encrypted JWT storage |
| Camera | `expo-camera` | QR code scanning for dine-in tables |
| Location | `expo-location` | Delivery address GPS fallback |
| Maps | `react-native-maps` | Order tracking driver map |
| Notifications | `expo-notifications` | Push notifications (FCM/APNs) |
| Animations | `react-native-reanimated` | Smooth cart, tab, gesture animations |
| Icons | `@expo/vector-icons` (Feather) | Consistent with web Lucide set |
| Image | `expo-image` | Better caching than core Image |
| State | React Context (Auth + Cart) | Mirrors web app pattern |

---

## Folder Structure

```
habibi-mobile/
├── app.json                  ← Expo config (bundle IDs, icons, splash)
├── App.tsx                   ← Root: providers + navigation container
├── babel.config.js
├── tsconfig.json
├── .env                      ← EXPO_PUBLIC_API_URL, EXPO_PUBLIC_STRIPE_KEY
│
├── src/
│   ├── navigation/
│   │   ├── RootNavigator.tsx     ← Auth gate (logged in → MainTabs, else AuthStack)
│   │   ├── AuthStack.tsx         ← Login / Signup / ForgotPassword
│   │   ├── MainTabs.tsx          ← Bottom tabs: Home | Menu | Orders | Account
│   │   └── MenuStack.tsx         ← Menu → ItemDetail → Cart → Checkout → Confirmation
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignupScreen.tsx
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── home/
│   │   │   └── HomeScreen.tsx
│   │   ├── menu/
│   │   │   ├── MenuScreen.tsx
│   │   │   ├── ItemDetailScreen.tsx
│   │   │   └── BuildYourOwnScreen.tsx
│   │   ├── cart/
│   │   │   └── CartScreen.tsx
│   │   ├── checkout/
│   │   │   ├── CheckoutScreen.tsx
│   │   │   └── OrderConfirmationScreen.tsx
│   │   ├── tracking/
│   │   │   └── OrderTrackingScreen.tsx
│   │   ├── account/
│   │   │   ├── AccountScreen.tsx
│   │   │   ├── OrderHistoryScreen.tsx
│   │   │   ├── OrderDetailScreen.tsx
│   │   │   └── ProfileEditScreen.tsx
│   │   ├── catering/
│   │   │   └── CateringScreen.tsx
│   │   ├── locations/
│   │   │   └── LocationsScreen.tsx
│   │   └── dinein/
│   │       └── DineInLandingScreen.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── menu/
│   │   │   ├── MenuCard.tsx
│   │   │   ├── CategoryPill.tsx
│   │   │   └── RecommendationBand.tsx
│   │   ├── cart/
│   │   │   └── CartItem.tsx
│   │   ├── tracking/
│   │   │   ├── StatusTimeline.tsx
│   │   │   └── QueueWidget.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── ScreenWrapper.tsx
│   │
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── CartContext.tsx
│   │
│   ├── services/
│   │   ├── api.ts             ← Axios instance with auth interceptor
│   │   ├── menuAPI.ts
│   │   ├── orderAPI.ts
│   │   ├── authAPI.ts
│   │   ├── cartAPI.ts
│   │   └── socket.ts          ← socket.io-client singleton
│   │
│   ├── hooks/
│   │   ├── useCart.ts
│   │   ├── useAuth.ts
│   │   └── useSocket.ts
│   │
│   ├── theme/
│   │   ├── colors.ts          ← gold #E5B64E, bg #0a0a0a, etc.
│   │   ├── typography.ts
│   │   └── spacing.ts
│   │
│   └── utils/
│       ├── formatCurrency.ts
│       ├── formatDate.ts
│       └── storage.ts         ← SecureStore wrappers
│
└── assets/
    ├── icon.png               ← 1024x1024 app icon
    ├── splash.png             ← Splash screen
    └── adaptive-icon.png      ← Android adaptive icon
```

---

## Phase 1 — Foundation & Auth (Week 1)

**Goal:** App boots, navigates, and can log in / register with the real backend.

### Tasks
- [ ] Scaffold Expo project (`npx create-expo-app habibi-mobile --template expo-template-blank-typescript`)
- [ ] Install core dependencies (React Navigation, Axios, SecureStore, Reanimated)
- [ ] Configure `app.json` (name, slug, bundle IDs `com.habibihe.customer`, icons, splash)
- [ ] Set up `src/theme/` (colors, typography, spacing) — brand gold `#E5B64E`, dark bg `#0a0a0a`
- [ ] Build `RootNavigator` with auth gate (checks SecureStore for token on boot)
- [ ] Build `AuthStack` — Login, Signup, ForgotPassword screens
- [ ] Wire `AuthContext` — login, logout, register, token persistence via SecureStore
- [ ] Build Axios instance (`src/services/api.ts`) with base URL + auth interceptor
- [ ] Wire auth screens to real backend (`POST /api/auth/login`, `POST /api/auth/register`)
- [ ] Basic `MainTabs` shell (4 placeholder tabs with icons)

### Deliverable
Working auth flow — login persists across app restarts, logout clears token.

---

## Phase 2 — Home & Menu (Week 2)

**Goal:** User can browse the full menu, search, filter by category, and view item details.

### Tasks
- [ ] `HomeScreen` — hero banner, featured categories grid, "Popular Right Now" recommendation band, promo strip
- [ ] `MenuScreen` — category pills (horizontal scroll), search bar, item grid/list toggle
- [ ] `MenuCard` component — image, name, price, add-to-cart button with flash state
- [ ] `ItemDetailScreen` — full description, choices (required radio), add-ons (checkboxes), qty counter, special instructions, "Add to Cart"
- [ ] `BuildYourOwnScreen` — 4-step wizard (Base → Protein → Toppings → Sauce) matching web BYO flow
- [ ] `CartContext` — add, remove, update qty, clear; persists to AsyncStorage
- [ ] `RecommendationBand` component — fetches `GET /api/ai/recommendations?type=popular`, horizontal scroll, add-to-cart
- [ ] Cart badge on tab icon (shows item count)
- [ ] `menuAPI.ts` — `getAll()`, `getCategories()`

### Deliverable
Full menu browsable end-to-end, items add to cart, cart badge updates.

---

## Phase 3 — Cart & Checkout (Week 3)

**Goal:** User can checkout, pay with card (Stripe), and receive an order confirmation.

### Tasks
- [ ] `CartScreen` — item list with qty controls, remove, subtotal, promo code input, upsell row (Drinks/Extras)
- [ ] `CheckoutScreen` — delivery/pickup toggle, address input (Google Places Autocomplete via `expo-modules`), name + phone, order notes, delivery fee calc, order summary
- [ ] Dine-in mode detection — if `CartContext` has table set, hide delivery form, show table badge
- [ ] `@stripe/stripe-react-native` — Payment Sheet integration for card / Apple Pay / Google Pay
- [ ] PayPal — WebView to PayPal approval URL returned from backend
- [ ] Offline payment (Zelle/Cash) — modal with instructions
- [ ] `orderAPI.ts` — `placeOrder()`, `track()`, `getHistory()`
- [ ] `OrderConfirmationScreen` — order number, ETA, "Track My Order" CTA
- [ ] Coupon validation — inline text input, calls `POST /api/coupons/validate`

### Deliverable
Full order flow working with Stripe card payment, order lands in admin Orders page.

---

## Phase 4 — Order Tracking & Notifications (Week 4)

**Goal:** Real-time order status, driver map, queue position, push notifications.

### Tasks
- [ ] `OrderTrackingScreen` — order number input or auto-load from last order; status timeline (5 steps); estimated time
- [ ] Socket.IO singleton (`src/services/socket.ts`) — connects on app foreground, joins `order_<number>` room
- [ ] Real-time `order_status_updated` listener — updates timeline live
- [ ] `QueueWidget` component — "X orders ahead of yours" dot visualization, `queue_update` socket event
- [ ] Driver map — `react-native-maps` with restaurant pin, customer pin, driver pin (live from `driver_location_update` socket)
- [ ] Haversine ETA display — same formula as web
- [ ] `expo-notifications` setup — register device token, send to backend `POST /api/users/device-token`
- [ ] Background notification handler — tapping notification navigates to tracking screen
- [ ] `socket.ts` — `useSocket()` hook wrapping connect/disconnect lifecycle

### Deliverable
Live order status + driver map + push notifications on status change.

---

## Phase 5 — Account & Order History (Week 5)

**Goal:** Full account management — profile, addresses, order history, loyalty points.

### Tasks
- [ ] `AccountScreen` — tabs: Orders / Profile / Loyalty / Settings
- [ ] `OrderHistoryScreen` — paginated list, status badge, tap to expand
- [ ] `OrderDetailScreen` — line items, totals, delivery address, "Order Again" button
- [ ] `ProfileEditScreen` — name, email, phone update; password change
- [ ] Saved addresses CRUD — add, delete, set default
- [ ] Loyalty points display — gold progress bar, point balance, redemption info (100 pts = $1)
- [ ] Delete account — confirmation modal
- [ ] Settings — push notification toggle, SMS opt-out, app version
- [ ] `authAPI.ts` — `getProfile()`, `updateProfile()`, `changePassword()`, `deleteAccount()`

### Deliverable
Complete account screen matching all web account features.

---

## Phase 6 — Advanced Features (Week 6)

**Goal:** Dine-in QR scan, catering form, locations map, AI recommendations.

### Tasks
- [ ] **Dine-In QR Scan** — `expo-camera` barcode scanner; scans table QR → fetches `GET /api/dine-in/tables/by-slug/:slug`; sets table in CartContext; navigates to menu in dine-in mode
- [ ] `DineInLandingScreen` — welcome card, table name badge, 3-step how-it-works (same as web)
- [ ] **Catering** — `CateringScreen` — 3-step form matching web (event type grid, guest slider, service type, personal details, review + submit)
- [ ] **Locations** — `LocationsScreen` — map view (`react-native-maps`) with pins for each location; tap pin → address + hours bottom sheet
- [ ] **AI Recommendations** — `RecommendationBand` on HomeScreen with `type=for_you` for logged-in users
- [ ] **Also Liked** — show "Customers Also Loved" band on `ItemDetailScreen`
- [ ] App icon + splash screen final assets
- [ ] EAS Build config (`eas.json`) for development / preview / production profiles

### Deliverable
All 6 advanced features working; app ready for TestFlight / Play Store internal testing.

---

## Phase 7 — Polish & Store Release (Week 7)

**Goal:** App store ready.

### Tasks
- [ ] Dark mode support (already default dark theme; verify system light-mode override)
- [ ] Haptic feedback (`expo-haptics`) on cart add, checkout confirm
- [ ] Skeleton loaders for all async screens
- [ ] Error boundaries + empty states for every screen
- [ ] Deep linking — `habibihe://order-tracking/:orderNumber`, `habibihe://dine-in/:slug`
- [ ] Universal links setup (`apple-app-site-association`, `assetlinks.json`)
- [ ] Android: adaptive icon, `google-services.json` (FCM)
- [ ] iOS: `GoogleService-Info.plist` (FCM APNs), provisioning profiles via EAS
- [ ] EAS Submit — Google Play (AAB) + App Store (IPA) submission config
- [ ] Privacy policy + permissions justification text (camera, location, notifications)
- [ ] OTA update channel (`expo-updates`) for production

### Deliverable
App submitted to Google Play Internal Testing and TestFlight.

---

## Backend Changes Needed

The existing backend is largely ready. A few small additions required:

| Endpoint | Change needed |
|---|---|
| `POST /api/users/device-token` | NEW — save `expo_push_token` to `users` table |
| `DELETE /api/users/device-token` | NEW — remove token on logout |
| FCM/APNs via Expo | Use `expo-server-sdk` instead of raw Firebase SDK for sending push to Expo tokens |
| `GET /api/dine-in/tables/by-slug/:slug` | Already exists ✅ |
| `GET /api/ai/recommendations` | Already exists ✅ |
| All auth, menu, order, cart routes | Already exist ✅ |

---

## Environment Variables

```env
# habibi-mobile/.env
EXPO_PUBLIC_API_URL=http://localhost:5001
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_GOOGLE_MAPS_KEY=AIza...
```

---

## Key Design Decisions

1. **Expo managed over bare** — Avoids Xcode/Android Studio complexity for initial phases. Can eject later if needed for advanced native modules.
2. **Same backend, no mobile-specific routes** — Mobile consumes existing REST API. Only addition is device token endpoint.
3. **Dark theme by default** — Matches web app's brand palette. `#0a0a0a` background, `#E5B64E` gold, `#f1f1f1` text.
4. **Context mirrors web** — `AuthContext` and `CartContext` are near-identical to web versions, just replacing `localStorage` with `SecureStore`/`AsyncStorage`.
5. **Expo Router vs React Navigation** — Using React Navigation v7 (classic) for explicit control over tab/stack nesting, which matches the complex navigation this app needs.
6. **EAS Build** — Replaces `expo build` (deprecated). Builds happen in Expo cloud — no local Android/iOS SDK needed.

---

## Progress Tracker

| Phase | Name | Status | Target |
|---|---|---|---|
| 1 | Foundation & Auth | ⬜ Not started | Week 1 |
| 2 | Home & Menu | ⬜ Not started | Week 2 |
| 3 | Cart & Checkout | ⬜ Not started | Week 3 |
| 4 | Order Tracking & Push | ⬜ Not started | Week 4 |
| 5 | Account & History | ⬜ Not started | Week 5 |
| 6 | Advanced Features | ⬜ Not started | Week 6 |
| 7 | Polish & Store Release | ⬜ Not started | Week 7 |
