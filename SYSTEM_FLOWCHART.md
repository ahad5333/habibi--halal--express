# Habibi Halal Express — System Flowchart

---

## 1. Customer Order Flow (Website)

```mermaid
flowchart TD
    A([👤 Customer visits habibihe.com]) --> B[Browse Menu\n172 items · 9 categories]
    B --> C[Add Items to Cart\nChoices · Add-ons · Qty · Special note]
    C --> D{Logged In?}
    D -->|Yes| E[Cart synced to DB\nLoyalty points shown]
    D -->|No| F[Guest cart in memory]
    E --> G[Checkout Page]
    F --> G

    G --> H{Order Type?}

    H -->|🚗 Delivery| I[Enter Address\nGoogle Maps autocomplete\nDelivery fee calculated live]
    H -->|🏃 Pickup| J[Select pickup time]
    H -->|🍽️ Dine-In| K[QR code scanned\nTable auto-assigned\nNo delivery fee]

    I --> L[Apply Coupon Code?\nLive validation · Discount applied]
    J --> L
    K --> L

    L --> M[Select Tip\n0% · 5% · 10% · 15% · 20%]
    M --> N{Payment Method?}

    N -->|💳 Card| O[Stripe Payment Element\nApple Pay · Google Pay included]
    N -->|🅿️ PayPal| P[PayPal SDK button\nServer-side capture]
    N -->|📲 Zelle / CashApp| Q[Offline modal shows\npayment handle · Customer confirms]
    N -->|💵 Cash| R[Pay on delivery]

    O --> S[Place Order →]
    P --> S
    Q --> S
    R --> S

    S --> T[(PostgreSQL\nguest_orders)]
    T --> U[✅ Order number generated\ne.g. HHE-20240524-8821]
    U --> V[Customer redirected to\n/order-confirmation]
    V --> W[/order-tracking]
```

---

## 2. After Order Is Placed

```mermaid
flowchart TD
    A([Order saved to DB]) --> B

    subgraph NOTIFY [" 📣 Notifications Fire Simultaneously "]
        B[📧 Email receipt\nvia SendGrid] 
        C[📱 SMS confirmation\nvia Twilio]
        D[🔔 Push notification\nvia Firebase FCM]
        E[🔔 In-app bell\nuser_notifications table]
    end

    A --> C
    A --> D
    A --> E

    A --> F{Delivery order?}

    F -->|Yes| G[Google Maps\nDistance Matrix API]
    F -->|No - Pickup or Dine-In| M

    G --> H{Distance from restaurant?}

    H -->|≤ 3 miles| I[🏠 In-House Delivery\nAdmin manually assigns\nemployee driver]
    H -->|3 – 10 miles| J[🚗 DoorDash Drive API\nAuto-dispatched instantly\nDoorDash driver notified on their app]
    H -->|10+ miles| K[🚚 Roadie API\nAuto-dispatched instantly\nRoadie driver notified on their app]

    I --> L[Driver GPS → Socket.IO\n→ Live map on /order-tracking]
    J --> L
    K --> L

    L --> M([Admin Live Order Board notified])
```

---

## 3. Admin & Kitchen Flow

```mermaid
flowchart TD
    A([New order arrives]) --> B

    subgraph ADMIN [" 🖥️ Admin CPanel — habibihe.com/admin "]
        B[🔴 PENDING\nLive Board shows order]
        B --> C[Admin clicks Accept\n→ SMS + Email + Push fires]
        C --> D[🟡 PREPARING\nKitchen gets the order]
        D --> E[Admin marks Ready\n→ SMS + Email + Push fires]
        E --> F{Delivery method?}
        F -->|Delivery| G[🚗 OUT FOR DELIVERY\nDriver dispatched or assigned]
        F -->|Pickup| H[✅ READY FOR PICKUP\nCustomer notified]
        F -->|Dine-In| I[✅ SERVED TO TABLE\nTable number shown]
        G --> J[Admin marks Delivered\n→ Final SMS + Email fires]
    end

    subgraph KITCHEN [" 👨‍🍳 Kitchen Display — /kitchen "]
        K[Auto-refreshes every 30 seconds]
        K --> L{Dine-In?}
        L -->|Yes| M[Shows table number\nStaff brings food]
        L -->|No| N[Shows order number\nPickup counter]
    end

    D --> K

    subgraph QUEUE [" 📊 Queue System "]
        O[/order-tracking shows\nX orders ahead of yours]
        O --> P[Socket.IO pushes\nqueue_update on every\nstatus change]
    end

    B --> O
```

---

## 4. Real-Time Order Tracking (Customer)

```mermaid
flowchart TD
    A([Customer opens /order-tracking]) --> B[Enters order number]
    B --> C[GET /api/orders/track/:orderNumber]
    C --> D[Order details loaded\nstatus · items · address · ETA]

    D --> E[Socket.IO connects\njoins room: order_NUMBER]

    E --> F{Listening for events}

    F --> G[order_status_updated\nStatus badge updates live]
    F --> H[driver_location_update\nDriver pin moves on map]
    F --> I[queue_update\nPosition number changes]

    subgraph MAP [" 🗺️ Live Driver Map "]
        J[📍 Restaurant pin — gold]
        K[📍 Customer pin — green\nGeocoded from address]
        L[🛵 Driver pin — animated\nUpdates every GPS ping]
        M[ETA calculated via\nHaversine distance formula]
    end

    H --> L

    subgraph CHAT [" 💬 Driver Chat "]
        N[Customer sends message]
        N --> O[Socket.IO → DB persist\nchat_messages table]
        O --> P[Driver sees message\non their DriverView screen]
        P --> Q[Driver replies\nCustomer sees instantly]
    end
```

---

## 5. Marketplace Orders (Milestone 2)

```mermaid
flowchart TD
    subgraph PLATFORMS [" Customer orders through 3rd-party app "]
        A[🟠 UberEats App\nCustomer orders Habibi food]
        B[🔴 DoorDash App\nCustomer orders Habibi food]
        C[🟡 GrubHub App\nCustomer orders Habibi food]
    end

    A -->|Webhook POST| D[/api/marketplace/webhook/ubereats]
    B -->|Webhook POST| E[/api/marketplace/webhook/caviar]
    C -->|Webhook POST| F[/api/marketplace/webhook/grubhub]

    D --> G[Normalized to\nmarketplace_orders table]
    E --> G
    F --> G

    G --> H[Socket.IO emits\nmarketplace_order event]
    H --> I[Admin MarketplaceOrders page\nUberEats · DoorDash · GrubHub tabs]

    I --> J{Admin action}
    J -->|Accept| K[Order goes to kitchen]
    J -->|Decline| L[Platform notified · Customer refunded\nby the platform]

    K --> M[Platform handles delivery\nwith their own drivers\nHabibi never dispatches for these]

    style M fill:#166534,color:#fff
```

---

## 6. Partner / Wholesale Portal

```mermaid
flowchart TD
    A([Business visits habibihe.com/wholesale]) --> B[Apply for partner account\nSubmit EIN + certificate]
    B --> C[Admin reviews application\nApproves + sets price tier]
    C --> D[Partner gets email\nwith login credentials]

    D --> E[Login at /partner/login]
    E --> F[Partner Portal]

    subgraph PORTAL [" 🏢 Partner Portal "]
        F --> G[Browse Wholesale Catalog\nTier-based pricing: Standard · Silver · Gold]
        G --> H[Add to bulk cart\nMin quantity enforced]
        H --> I[Place order\nInvoice generated]
    end

    I --> J[(partner_orders table)]
    J --> K[Admin sees order\nat /admin/partner-orders]
    K --> L[Admin updates status\nConfirmed → Processing → Shipped → Delivered]
    L --> M[📧 Partner email notification\nDark-branded partner template]
```

---

## 7. Data & Infrastructure Layer

```mermaid
flowchart LR
    subgraph FRONTEND [" 🌐 Frontend — Vite + React "]
        A[habibihe.com]
        B[habibihe.com/admin]
    end

    subgraph BACKEND [" ⚙️ Backend — Express.js 5 "]
        C[REST API\n30 route groups]
        D[Socket.IO Server\nReal-time events]
        E[Helmet · Rate Limiting\nMorgan · CORS]
    end

    subgraph DB [" 🐘 PostgreSQL "]
        F[(30 Tables\nguest_orders · users · menu_items\ndoordash_deliveries · roadie_deliveries\nuser_notifications · chat_messages\nand 24 more...)]
    end

    subgraph EXTERNAL [" 🔌 External Services "]
        G[Stripe]
        H[PayPal]
        I[Twilio SMS]
        J[SendGrid Email]
        K[Firebase FCM Push]
        L[Google Maps]
        M[DoorDash Drive]
        N[Roadie]
    end

    A <-->|VITE_API_URL| C
    B <-->|VITE_API_URL| C
    A <-->|Socket.IO| D
    B <-->|Socket.IO| D
    C <--> F
    D <--> F
    C --> G
    C --> H
    C --> I
    C --> J
    C --> K
    C --> L
    C --> M
    C --> N
```

---

## Quick Reference — All API Routes

| Method | Route | What it does |
|---|---|---|
| POST | `/api/auth/register` | Create account + send verification email |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/verify-email` | Verify email token → auto login |
| POST | `/api/auth/forgot-password` | Send reset link |
| POST | `/api/auth/reset-password` | Set new password |
| POST | `/api/orders/guest` | Place order (no auth needed) |
| GET | `/api/orders/track/:num` | Track any order by number |
| GET | `/api/orders/queue/:num` | Queue position |
| GET | `/api/orders/chat/:num` | Chat history |
| POST | `/api/payments/create-intent` | Stripe payment intent |
| POST | `/api/payments/paypal/capture` | Confirm PayPal payment |
| GET | `/api/menus` | All menu items + categories |
| POST | `/api/dispatch/calculate-fee` | Delivery fee from address |
| GET | `/api/users/me` | My profile |
| GET | `/api/users/me/notifications` | Notification inbox |
| GET | `/api/dine-in/tables/by-slug/:slug` | Table from QR code |
| GET | `/api/dine-in/kitchen` | Kitchen display data |
| GET | `/api/locations` | All restaurant locations |
| POST | `/api/coupons/validate` | Validate coupon code |
| GET | `/health` | DB ping for uptime monitors |
