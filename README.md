# Habibi Halal Express — Full Stack Platform

A complete restaurant ordering platform for **Habibi Halal Express, INC** — Bronx, NY.  
Domain: [habibihe.com](https://habibihe.com)

---

## What's Included

| Project | Description | Tech | Port |
|---|---|---|---|
| `habibi-frontend` | Customer ordering website | React 19 + Vite | 5173 |
| `habibi-admin` | Admin control panel | React 19 + Vite | 5174 |
| `habibi-backend` | REST API + real-time server | Express.js + PostgreSQL | 5001 |
| `habibi-merchant-app` | Tablet order display (Android) | React Native + Expo | — |
| `habibi-mobile` | Customer mobile app (iOS/Android) | React Native + Expo | — |
| `habibi-business-app` | Wholesale B2B app | React Native + Expo | — |

---

## Tech Stack

**Frontend / Admin**
- React 19, Vite, React Router v6
- CSS Modules (no Tailwind)
- Lucide React icons
- Stripe.js, PayPal SDK

**Backend**
- Node.js + Express.js 5 (CommonJS)
- PostgreSQL via `pg` pool (raw SQL, no ORM)
- JWT authentication (HS256)
- Socket.IO for real-time order updates
- PM2 for production process management

**Payments**
- Stripe (card + Apple/Google Pay)
- PayPal SDK
- Offline: Zelle / Cash

**Integrations**
- DoorDash Drive API (delivery dispatch)
- UberEats / GrubHub / Caviar webhooks
- Google Maps (distance matrix + Places)
- Twilio (SMS)
- SendGrid (email)
- Firebase FCM (push notifications)

---

## Project Structure

```
habibi-halal-express/
├── habibi-frontend/        # Customer website
│   ├── src/
│   │   ├── pages/          # Home, Menu, Checkout, etc.
│   │   ├── components/     # Navbar, Footer, etc.
│   │   ├── context/        # CartContext, AuthContext
│   │   └── services/       # API service layer
│   ├── public/
│   └── .env.example
│
├── habibi-admin/           # Admin control panel
│   ├── src/
│   │   ├── pages/          # Dashboard, Orders, Menu, etc.
│   │   ├── components/     # Sidebar, TopBar
│   │   └── context/        # AdminAuthContext
│   └── .env.example
│
├── habibi-backend/         # Express API server
│   ├── src/
│   │   ├── routes/         # All API routes
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # Auth, validation, rate limiting
│   │   ├── config/         # DB pool + table init
│   │   └── utils/
│   ├── public/             # Static files + videos
│   └── .env.example
│
├── habibi-merchant-app/    # Android tablet merchant app
├── habibi-mobile/          # Customer iOS/Android app
└── habibi-business-app/    # Wholesale B2B app
```

---

## Local Development Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### 1. Clone the repository
```bash
git clone https://github.com/ahad5333/habibi--halal--express.git
cd habibi--halal--express
```

### 2. Backend setup
```bash
cd habibi-backend
npm install
cp .env.example .env
# Edit .env with your database credentials and API keys
node server.js
# Runs on http://localhost:5001
```

### 3. Frontend setup
```bash
cd habibi-frontend
npm install
cp .env.example .env
# Edit .env — set VITE_API_URL=http://localhost:5001
npm run dev
# Runs on http://localhost:5173
```

### 4. Admin panel setup
```bash
cd habibi-admin
npm install
cp .env.example .env
# Edit .env — set VITE_API_URL=http://localhost:5001
npm run dev
# Runs on http://localhost:5174
```

---

## Environment Variables

All `.env` files are excluded from git for security.  
Copy the `.env.example` in each project and fill in real values.

### Backend (`.env`) — Key Variables

```env
PORT=5001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@host:5432/habibi_db

# Auth
JWT_SECRET=your_jwt_secret_here

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Email (SendGrid)
SENDGRID_API_KEY=...

# SMS (Twilio)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Google Maps
GOOGLE_MAPS_API_KEY=...

# CORS — add your live domain
CORS_ORIGINS=https://habibihe.com,https://admin.habibihe.com
```

### Frontend (`.env`)

```env
VITE_API_URL=https://api.habibihe.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_PAYPAL_CLIENT_ID=...
```

---

## Admin Credentials (Local Dev)

```
Email:    admin@habibihe.com
Password: Admin@Habibi1
```

---

## Key Features

**Customer Website**
- Full menu with categories, search, smoke/ice effects
- Build Your Own Bowl interactive builder
- Cart with live quantity stepper
- Checkout with Stripe, PayPal, Zelle/Cash
- Order tracking with real-time status updates
- Guest + account ordering
- Loyalty points system
- Delivery fee calculator (Google Maps)
- Coupon & offers system
- Reviews & ratings

**Admin Panel (Dark Theme)**
- Live order board with real-time Socket.IO
- Menu builder (add/edit/delete items)
- Customer management
- Analytics & revenue reports
- Coupon management
- Delivery dispatch
- Staff management
- Partner orders (UberEats/DoorDash/GrubHub)
- Broadcast messages
- AI assistant

**Backend API**
- 40+ REST endpoints
- JWT auth with role-based access (admin, customer, partner)
- Rate limiting on auth, payment, and order routes
- Real-time order events via Socket.IO
- Automatic table creation on startup

---

## Production Deployment

### Server Requirements
- Ubuntu 22.04 VPS (2GB RAM minimum)
- Node.js 18+ (install via NVM)
- PostgreSQL 14+
- Nginx
- PM2
- Certbot (Let's Encrypt SSL)

### Deploy Backend
```bash
git clone https://github.com/ahad5333/habibi--halal--express.git
cd habibi--halal--express/habibi-backend
npm install --production
# Create .env with production values
NODE_ENV=production pm2 start server.js --name habibi-backend
pm2 save
pm2 startup
```

### Build & Deploy Frontend
```bash
cd habibi-frontend
npm install
npm run build
# Upload dist/ to /var/www/habibihe.com/
```

### Build & Deploy Admin
```bash
cd habibi-admin
npm install
npm run build
# Upload dist/ to /var/www/admin.habibihe.com/
```

### Nginx Configuration
```nginx
# habibihe.com — Frontend
server {
    server_name habibihe.com www.habibihe.com;
    root /var/www/habibihe.com;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

# admin.habibihe.com — Admin panel
server {
    server_name admin.habibihe.com;
    root /var/www/admin.habibihe.com;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

# api.habibihe.com — Backend API
server {
    server_name api.habibihe.com;
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## API Endpoints (Key)

| Method | Route | Description |
|---|---|---|
| GET | `/api/menus` | Get all menu items |
| POST | `/api/auth/login` | Login (email or phone) |
| POST | `/api/auth/register` | Register new customer |
| POST | `/api/orders/guest` | Place a guest order |
| GET | `/api/orders` | Get customer order history |
| GET | `/api/admin/orders` | Get all orders (admin) |
| GET | `/api/admin/analytics/revenue` | Revenue analytics |
| GET | `/api/admin/customers` | Customer list |
| GET | `/api/ai/recommendations` | AI item recommendations |
| POST | `/api/contact` | Submit contact form |
| GET | `/api/locations` | Restaurant locations |
| GET | `/api/coupons` | Active coupons |

---

## License

Private — All rights reserved.  
© 2024 Habibi Halal Express, INC. Bronx, NY.
