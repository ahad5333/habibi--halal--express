# Habibi Halal Express — Customer Mobile App
## Production Gaps & TODO Tracker

> Only items that are **still missing or incomplete** are listed here.
> Completed items have been removed to keep this file actionable.
> Last updated: 2026-05-23

---

## ✅ COMPLETED

| What | When |
|---|---|
| LayoutAnimation Android fix (`UIManager` in App.tsx) | Session 2 |
| Active order tracking banner on HomeScreen | Session 2 |
| Real order history in AccountScreen | Session 2 |
| Real addresses + CRUD in AccountScreen | Session 2 |
| Real payment methods + CRUD in AccountScreen | Session 2 |
| HelpSupportScreen (replaces About accordion) | Session 2 |
| LocationsScreen fetches real data from backend | Session 2 |
| OrderConfirmationScreen redesign | Session 2 |
| Storage.setLastOrder wired at checkout | Session 2 |
| Push notification channels: `orders` + `promotions` | Session 2 |
| Device token registered on login/app start | Session 2 |
| Admin broadcasts frontend page `/admin/broadcasts` | Session 2 |
| `eas.json` build profiles configured | Pre-existing |
| Catering form already submits to backend | Pre-existing |
| Loyalty points — live from `user.loyalty_points` | Session 3 |
| Personalized time-based greeting on HomeScreen | Session 3 |
| Catering entry card on HomeScreen | Session 3 |
| Avatar fallback — local asset (was Unsplash URL) | Session 3 |
| Voice search mic — navigates to Menu search | Session 3 |
| Locations quick-link card at bottom of HomeScreen | Session 3 |
| Open/Closed status badge — computed client-side from known hours (Gap #9) | Session 3 |
| Offers Screen — live `GET /api/offers`, loading + empty states (Gap #11) | Session 3 |
| Driver Chat — real WebSocket + DB persistence (Gap #12) | Session 3 |
| Live driver GPS tracking — socket event name mismatches fixed (Gap #13) | Session 3 |
| Loyalty Points earn/redeem — 1 pt/$1 on delivery, 500 pts = $5 toggle at checkout (Gap #14) | Session 3 |
| Profile Photo Upload — expo-image-picker → Cloudinary → `PUT /api/users/me` (Gap #15) | Session 3 |
| Recommendation Band — wired to real `/api/menu/recommendations?limit=6` (Gap #16) | Session 3 |
| Dine-In Order Submission — `delivery_method` + `table_number` fixed end-to-end (Gap #17) | Session 3 |
| Notification Bell + Inbox — `user_notifications` table, GET/PATCH routes, HomeScreen bell, NotificationsScreen (Gap #10) | Session 3 |

---

## 🔴 PRODUCTION BLOCKERS
*App will not function correctly in a real production build without these. All require external accounts/credentials — tackle when ready to ship.*

### 1. EAS Project ID — Push Notifications Dead
- **File:** `habibi-mobile/app.json` → `extra.eas.projectId`
- **Current value:** `"YOUR_EAS_PROJECT_ID"` (placeholder)
- **What breaks:** All push notifications silently fail — order updates, marketing broadcasts, everything.
- **Fix:** Create/link project at `expo.dev` → copy real project ID → paste into `app.json`.

### 2. Google Maps API Key — Android Map Broken in Production
- **File:** `habibi-mobile/app.json` → `android.config`
- **Current state:** Key not present. Works in Expo Go (shared dev key), blank grey tile in standalone Android build.
- **Fix:**
  ```json
  "android": {
    "package": "com.habibihe.customer",
    "config": {
      "googleMaps": { "apiKey": "AIza..." }
    }
  }
  ```

### 3. Stripe Shim — No Real Payments
- **File:** `habibi-mobile/src/stripe.ts`
- **What it does now:** Shows Alert dialog, simulates success. Zero real charges.
- **Fix for EAS build:**
  1. Change all imports from `'../../stripe'` → `'@stripe/stripe-react-native'`
  2. Delete `src/stripe.ts`
  3. Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` in EAS secrets

### 4. ~~WebBrowser Shim — PayPal Never Completes~~ ✅ DONE
- `CheckoutScreen.tsx` import swapped from `'../../webBrowser'` → `'expo-web-browser'`.
- `src/webBrowser.ts` shim deleted. `expo-web-browser` was already installed (`~14.1.6`).

### 5. ~~Backend: Device Token Endpoint~~ ✅ ALREADY DONE
- `POST /api/users/me/device-token` exists in `userRoutes.js` → `registerDeviceToken` in `userController.js`.
- `user_device_tokens` table already created in `init.js`. UPSERT on conflict so re-installs update cleanly.
- `fcmService.js` already reads from this table to deliver per-user push notifications.

### 6. Firebase Credentials — Android Push Dead in Production
- **What's needed:** `google-services.json` from Firebase Console.
- **Fix:**
  ```json
  "android": {
    "googleServicesFile": "./google-services.json"
  }
  ```
  Then add the file to EAS secrets: `eas secret:create --name GOOGLE_SERVICES_JSON`.

### 7. APNs Key — iOS Push Dead in Production
- **What's needed:** Apple Push Notification key from Apple Developer account.
- **Fix:** `eas credentials` → select iOS → Add push notification key → upload `.p8` file.

### 8. ~~Production API URL Not Set~~ ✅ DONE
- `eas.json` `production` profile now has `"env": { "EXPO_PUBLIC_API_URL": "https://api.habibihalal.com" }`.
- Local `.env` keeps the dev IP — production builds automatically override it via EAS env block.

---

## 🔵 APP STORE / PLAY STORE CHECKLIST
*Tackle after all production blockers are cleared.*

### 9. App Store Connect — iOS (not started)
- [ ] App name, subtitle, description, keywords
- [ ] Screenshots: 6.7" iPhone 16 Pro Max, 6.1" iPhone 16
- [ ] App icon: 1024×1024 PNG, no transparency, no rounded corners
- [ ] Privacy policy URL (live, accessible)
- [ ] Terms of service URL
- [ ] Age rating: 4+
- [ ] TestFlight internal test before review submission
- [ ] `eas.json` → fill `appleId`, `ascAppId`, `appleTeamId` (from Apple Developer account)

### 10. Google Play Console — Android (not started)
- [ ] App name, short description (80 chars max), full description
- [ ] Screenshots: phone 16:9, 7" tablet, 10" tablet
- [ ] Feature graphic: 1024×500 PNG
- [ ] Content rating questionnaire
- [ ] Data safety form (discloses: name, email, phone, location, device ID collected)
- [ ] Privacy policy URL
- [ ] Release notes for v1.0.0

### 11. Final Brand Assets — Confirm Not Placeholder
- `habibi-mobile/assets/icon.png` — must be 1024×1024, no alpha channel
- `habibi-mobile/assets/splash.png` — 1284×2778 recommended for all device sizes
- `habibi-mobile/assets/adaptive-icon.png` — 1024×1024 Android foreground layer
- **Confirm these are final brand files, not the default Expo blue/purple placeholders.**

---

## ⚙️ ENVIRONMENT VARIABLES NEEDED FOR EAS BUILD

```env
EXPO_PUBLIC_API_URL=https://api.habibihalal.com
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_GOOGLE_MAPS_KEY=AIza...
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=habibi_avatars_unsigned
```

Set via `eas secret:create --name VAR_NAME --value "value"` for production builds.

---

## 📋 WHAT REMAINS

### When ready to go to production (in order):
1. Get EAS project ID from `expo.dev` → paste into `app.json` — Blocker #1
2. Get Google Maps API key → add to `app.json` android config — Blocker #2
3. Swap Stripe shim → `@stripe/stripe-react-native`, delete `src/stripe.ts` — Blocker #3
4. ~~Swap WebBrowser shim → `expo-web-browser`, delete `src/webBrowser.ts` — Blocker #4~~ ✅ Done
5. ~~Add device token endpoint to backend — Blocker #5~~ ✅ Already done
6. Add `google-services.json` from Firebase → EAS secret — Blocker #6
7. Upload APNs `.p8` key via `eas credentials` — Blocker #7
8. ~~Set `EXPO_PUBLIC_API_URL` to production URL — Blocker #8~~ ✅ Done

### When ready to submit to stores:
9. Complete App Store Connect listing — #9
10. Complete Google Play Console listing — #10
11. Confirm final brand assets (icon, splash, adaptive icon) — #11

---

*Last updated: 2026-05-23*
*App version: 1.0.0 (pre-release)*
*Framework: Expo SDK 56 / React Native 0.85.3*
*Feature gaps: 0 ✅ | Production blockers: 5 | Store prep: 3*
