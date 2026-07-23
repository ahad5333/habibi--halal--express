const pool = require("./db");
const bcrypt = require("bcryptjs");

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Core: Users ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(255),
        email         VARCHAR(255) UNIQUE NOT NULL,
        phone_number  VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(50) DEFAULT 'customer'
                        CHECK (role IN ('customer','merchant','admin','business')),
        is_active     BOOLEAN DEFAULT TRUE,
        is_partner    BOOLEAN DEFAULT FALSE,
        partner_id    INTEGER,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Users: safe migration columns ─────────────────────────────
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name                     VARCHAR(255)`);
    await client.query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified            BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points        INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url            VARCHAR(500)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_sms_updates   BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth         DATE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider             VARCHAR(20)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id          VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_code_hash           VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_code_expires        TIMESTAMPTZ`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_code_attempts       INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday_rewarded_year  INTEGER`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dietary_prefs          JSONB DEFAULT '{}'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_otp_hash          VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_otp_expires       TIMESTAMPTZ`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_otp_attempts      INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_partner             BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id             INTEGER`);

    // ── Coupons: safe migration columns ───────────────────────────
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS title               VARCHAR(255)`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description         TEXT`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_from          TIMESTAMPTZ`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_until         TIMESTAMPTZ`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_email      VARCHAR(255)`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS location_id         INTEGER REFERENCES locations(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS free_item_category  VARCHAR(100)`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS condition_type      VARCHAR(50)`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS condition_value     NUMERIC(10,2)`);

    // ── Partner applications: add payment_methods + credit_balance ──
    await client.query(`ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '[]'`);
    await client.query(`ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS credit_balance  NUMERIC(10,2) DEFAULT 0`);

    // ── Locations: add pre-selected delivery addresses ─────────────
    await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS delivery_addresses JSONB DEFAULT '[]'`);

    // ── Marketplace orders: add location tracking ─────────────────
    await client.query(`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS platform_store_id VARCHAR(255)`);

    // ── Soft-delete for guest_orders ──────────────────────────────
    await client.query(`ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_guest_orders_deleted_at ON guest_orders(deleted_at) WHERE deleted_at IS NOT NULL`);

    // ── User search indexes (ILIKE performance) ───────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_name_lower  ON users(LOWER(name))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email))`);

    // ── JWT revocation (durable across restarts) ──────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti        TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(expires_at)`);

    // ── Addresses: user ownership column ──────────────────────────
    await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id)`);

    // ── Group orders: host ownership ──────────────────────────────
    await client.query(`ALTER TABLE group_order_sessions ADD COLUMN IF NOT EXISTS host_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);

    // ── Per-location menu item availability ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_location_availability (
        menu_id     INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
        location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        status      VARCHAR(20) NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'sold_out', 'inactive')),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (menu_id, location_id)
      )
    `);

    // ── Urgent requests: make phone nullable for contact-form use ──
    await client.query(`ALTER TABLE urgent_requests ALTER COLUMN phone DROP NOT NULL`).catch(() => {});

    // ── Customers (profile extension of users) ────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id                  SERIAL PRIMARY KEY,
        user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
        first_name          VARCHAR(100),
        last_name           VARCHAR(100),
        business_name       VARCHAR(255),
        date_of_birth       DATE,
        receive_sms_updates BOOLEAN DEFAULT TRUE,
        receive_promotions  BOOLEAN DEFAULT FALSE,
        last_login          TIMESTAMP
      );
    `);

    // ── Addresses ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id                 SERIAL PRIMARY KEY,
        customer_id        INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        receiver_name      VARCHAR(200),
        street_address     VARCHAR(255) NOT NULL,
        second_line        VARCHAR(255),
        city               VARCHAR(100) NOT NULL,
        state              VARCHAR(50)  NOT NULL,
        zip_code           VARCHAR(10)  NOT NULL,
        driver_instruction TEXT,
        is_default         BOOLEAN DEFAULT FALSE,
        is_gift_order      BOOLEAN DEFAULT FALSE,
        latitude           NUMERIC(10,7),
        longitude          NUMERIC(10,7),
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Locations ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id                     SERIAL PRIMARY KEY,
        title                  VARCHAR(255) NOT NULL,
        brief_address          VARCHAR(255),
        exact_address          TEXT,
        phone_number           VARCHAR(50),
        image_url              TEXT,
        working_days_hours     TEXT,
        holidays               TEXT,
        location_note          TEXT,
        is_active              BOOLEAN DEFAULT TRUE,
        preference_level       INTEGER DEFAULT 0,
        self_delivery_enabled  BOOLEAN DEFAULT TRUE,
        delivery_radius_miles  NUMERIC(8,2) DEFAULT 5.0,
        delivery_cost          NUMERIC(10,2) DEFAULT 0,
        latitude               NUMERIC(10,7),
        longitude              NUMERIC(10,7),
        created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Categories ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(100) UNIQUE NOT NULL,
        image_url  TEXT,
        preference INTEGER DEFAULT 1,
        is_active  BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Menu Items ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id            SERIAL PRIMARY KEY,
        title         VARCHAR(255) NOT NULL,
        description   TEXT,
        price         NUMERIC(10,2) NOT NULL,
        partner_price NUMERIC(10,2),
        category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        image_url     TEXT,
        is_available  BOOLEAN DEFAULT TRUE,
        preference    INTEGER DEFAULT 1,
        note          TEXT,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Menu ↔ Location junction ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_item_locations (
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
        location_id  INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        PRIMARY KEY (menu_item_id, location_id)
      );
    `);

    // ── Choice Groups & Options (required/single-select) ─────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS choice_groups (
        id           SERIAL PRIMARY KEY,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
        title        VARCHAR(255) NOT NULL,
        preference   INTEGER DEFAULT 1,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS choice_options (
        id              SERIAL PRIMARY KEY,
        choice_group_id INTEGER REFERENCES choice_groups(id) ON DELETE CASCADE,
        title           VARCHAR(255) NOT NULL,
        extra_price     NUMERIC(10,2) DEFAULT 0,
        is_default      BOOLEAN DEFAULT FALSE,
        preference      INTEGER DEFAULT 1
      );
    `);

    // ── Addon Groups & Options (optional/multi-select) ────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS addon_groups (
        id           SERIAL PRIMARY KEY,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
        title        VARCHAR(255) NOT NULL,
        preference   INTEGER DEFAULT 1,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS addon_options (
        id             SERIAL PRIMARY KEY,
        addon_group_id INTEGER REFERENCES addon_groups(id) ON DELETE CASCADE,
        title          VARCHAR(255) NOT NULL,
        price          NUMERIC(10,2) DEFAULT 0,
        preference     INTEGER DEFAULT 1
      );
    `);

    // ── Legacy tables (used by cart/order v1 controllers) ─────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS menus (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        price       NUMERIC(10,2) NOT NULL,
        image_url   TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Dietary flag columns (idempotent — safe to run on existing table)
    await client.query(`
      ALTER TABLE menus
        ADD COLUMN IF NOT EXISTS is_spicy       BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_vegetarian  BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN DEFAULT FALSE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id         SERIAL PRIMARY KEY,
        cart_id    INTEGER REFERENCES carts(id) ON DELETE CASCADE,
        menu_id    INTEGER REFERENCES menus(id) ON DELETE CASCADE,
        quantity   INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Guest Orders ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS guest_orders (
        id                    SERIAL PRIMARY KEY,
        order_number          VARCHAR(50) UNIQUE NOT NULL,
        customer_name         VARCHAR(255) DEFAULT 'Guest',
        customer_phone        VARCHAR(50)  DEFAULT '',
        customer_email        VARCHAR(255) DEFAULT '',
        delivery_method       VARCHAR(50)  DEFAULT 'delivery',
        delivery_address      TEXT         DEFAULT '',
        delivery_city         VARCHAR(100) DEFAULT '',
        delivery_zip          VARCHAR(20)  DEFAULT '',
        delivery_state        VARCHAR(50)  DEFAULT 'NY',
        delivery_instructions TEXT         DEFAULT '',
        payment_method        VARCHAR(50)  DEFAULT '',
        sub_total             NUMERIC(10,2) DEFAULT 0,
        tax                   NUMERIC(10,2) DEFAULT 0,
        service_fee           NUMERIC(10,2) DEFAULT 0,
        delivery_fee          NUMERIC(10,2) DEFAULT 0,
        tip                   NUMERIC(10,2) DEFAULT 0,
        discount              NUMERIC(10,2) DEFAULT 0,
        total                 NUMERIC(10,2) DEFAULT 0,
        coupon_code           VARCHAR(50),
        expected_time         VARCHAR(100),
        dispatch_fired        BOOLEAN      DEFAULT FALSE,
        order_status          VARCHAR(50)  DEFAULT 'pending',
        items                 JSONB        DEFAULT '[]',
        placed_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      -- Add column to existing tables (idempotent)
      ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS dispatch_fired BOOLEAN DEFAULT FALSE;
    `);

    // ── Dine-In Tables ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS dine_in_tables (
        id          SERIAL PRIMARY KEY,
        table_name  VARCHAR(50) NOT NULL,
        qr_slug     VARCHAR(100) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(50)`);
    await client.query(`ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`);
    await client.query(`ALTER TABLE guest_orders ALTER COLUMN order_status SET DEFAULT 'pending'`);
    await client.query(`ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER`);
    await client.query(`ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid'`);
    await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)`);
    await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS tablet_username VARCHAR(100)`);
    await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS tablet_password_hash VARCHAR(255)`);

    // ── Migrate carts.customer_id → user_id if old schema ─────────
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='carts' AND column_name='customer_id'
        ) THEN
          ALTER TABLE carts RENAME COLUMN customer_id TO user_id;
        END IF;
      END $$;
    `);

    // ── Coupons ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id                  SERIAL PRIMARY KEY,
        code                VARCHAR(50) UNIQUE NOT NULL,
        discount_type       VARCHAR(30) DEFAULT 'percentage'
                              CHECK (discount_type IN ('percentage','fixed','free_delivery')),
        discount_value      NUMERIC(10,2) DEFAULT 0,
        min_order_amount    NUMERIC(10,2) DEFAULT 0,
        max_discount        NUMERIC(10,2),
        usage_limit         INTEGER,
        used_count          INTEGER DEFAULT 0,
        location_id         INTEGER,
        expiry_date         DATE,
        target_product_id   INTEGER,
        is_first_order_only BOOLEAN DEFAULT FALSE,
        is_bogo             BOOLEAN DEFAULT FALSE,
        is_active           BOOLEAN DEFAULT TRUE,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Payment Methods ───────────────────────────────────────────
    // customer_id references customers.id (a separate 1:1 profile table,
    // linked via customers.user_id), NOT users.id directly — this was out
    // of sync with the real deployed schema (which uses customer_id/type/
    // last_four, no expiry column) until this table definition was fixed
    // to match what paymentMethodController.js actually expects.
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id          SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        type        VARCHAR(50),
        last_four   VARCHAR(4),
        token       VARCHAR(255),
        is_default  BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Quick Payments log ──────────────────────────────────────────
    // Durable record of every charge made through the "Make a Payment" page
    // (/payment), independent of whether it's tied to a real order — the
    // Authorize.net dashboard was previously the only record these existed.
    await client.query(`
      CREATE TABLE IF NOT EXISTS quick_payments (
        id             SERIAL PRIMARY KEY,
        order_number   VARCHAR(100),
        amount         NUMERIC(10,2) NOT NULL,
        reason         VARCHAR(100),
        note           TEXT,
        customer_name  VARCHAR(255),
        customer_phone VARCHAR(30),
        transaction_id VARCHAR(100),
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Urgent Requests ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS urgent_requests (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(255),
        phone         VARCHAR(50),
        email         VARCHAR(255),
        order_id      VARCHAR(100),
        reason        VARCHAR(255),
        message       TEXT,
        urgency_level VARCHAR(20) DEFAULT 'High',
        status        VARCHAR(50) DEFAULT 'open',
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Newsletter Subscribers ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id         SERIAL PRIMARY KEY,
        email      TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64)`);
    await client.query(`UPDATE newsletter_subscribers SET unsubscribe_token = replace(gen_random_uuid()::text,'-','') WHERE unsubscribe_token IS NULL`);

    // ── Partner Applications ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_applications (
        id               SERIAL PRIMARY KEY,
        business_name    VARCHAR(255),
        ein_number       VARCHAR(50),
        contact_name     VARCHAR(255),
        email            VARCHAR(255),
        phone            VARCHAR(50),
        address          TEXT,
        certificate_url  TEXT,
        status           VARCHAR(50) DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected')),
        price_tier       VARCHAR(50),
        notes            TEXT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Delivery Tiers ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_tiers (
        id            SERIAL PRIMARY KEY,
        label         VARCHAR(100),
        min_distance  NUMERIC(8,2) DEFAULT 0,
        max_distance  NUMERIC(8,2) DEFAULT 999,
        provider_type VARCHAR(50) DEFAULT 'in_house',
        is_active     BOOLEAN DEFAULT TRUE
      );
    `);

    // ── Admin Sidebar ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_sidebar (
        id         SERIAL PRIMARY KEY,
        title      VARCHAR(100) NOT NULL,
        icon       VARCHAR(50),
        route      VARCHAR(100),
        sort_order INTEGER DEFAULT 1,
        is_active  BOOLEAN DEFAULT TRUE
      );
    `);

    // ── Payment Settings ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_settings (
        id          SERIAL PRIMARY KEY,
        label       VARCHAR(100) NOT NULL,
        provider    VARCHAR(50),
        is_active   BOOLEAN DEFAULT TRUE,
        config      JSONB DEFAULT '{}',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Reservations / Catering Quotes ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id             SERIAL PRIMARY KEY,
        name           VARCHAR(255),
        email          VARCHAR(255),
        phone          VARCHAR(50),
        party_size     INTEGER DEFAULT 1,
        scheduled_date TIMESTAMPTZ,
        notes          TEXT,
        status         VARCHAR(50) DEFAULT 'pending',
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Catering-specific columns (safe migrations)
    await client.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event_type      VARCHAR(100)`);
    await client.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS service_type    VARCHAR(50) DEFAULT 'delivery'`);
    await client.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS estimated_total NUMERIC(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS admin_notes     TEXT`);
    await client.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS invoice_sent    BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS quoted_price    NUMERIC(10,2)`);
    await client.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event_address   VARCHAR(500)`);

    // ── Business (Wholesale) Menu ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_menus (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        category      VARCHAR(100) DEFAULT 'General',
        price         NUMERIC(10,2) NOT NULL,
        price_tier_2  NUMERIC(10,2),
        price_tier_3  NUMERIC(10,2),
        min_quantity  INTEGER DEFAULT 1,
        unit          VARCHAR(50) DEFAULT 'case',
        image_url     TEXT,
        is_active     BOOLEAN DEFAULT TRUE,
        sort_order    INTEGER DEFAULT 1,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Partner Orders ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_orders (
        id                      SERIAL PRIMARY KEY,
        order_number            VARCHAR(50) UNIQUE NOT NULL,
        partner_user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
        partner_application_id  INTEGER REFERENCES partner_applications(id) ON DELETE SET NULL,
        business_name           VARCHAR(255),
        items                   JSONB DEFAULT '[]',
        sub_total               NUMERIC(10,2) DEFAULT 0,
        tax                     NUMERIC(10,2) DEFAULT 0,
        total                   NUMERIC(10,2) DEFAULT 0,
        delivery_address        TEXT,
        notes                   TEXT,
        price_tier              VARCHAR(50) DEFAULT 'tier_1',
        status                  VARCHAR(50) DEFAULT 'pending'
                                  CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
        placed_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Partner Orders: safe migration columns ────────────────────
    await client.query(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS payment_method      VARCHAR(100) DEFAULT 'invoice'`);
    await client.query(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS payment_status      VARCHAR(50)  DEFAULT 'unpaid'`);
    await client.query(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS delivery_fee        NUMERIC(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS service_fee         NUMERIC(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS credit_applied      NUMERIC(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`);
    // Extend the status CHECK to match business app statuses
    await client.query(`ALTER TABLE partner_orders DROP CONSTRAINT IF EXISTS partner_orders_status_check`);
    await client.query(`ALTER TABLE partner_orders ADD CONSTRAINT partner_orders_status_check
      CHECK (status IN ('created','pending','confirmed','processed','processing','on_the_way','shipped','delivered','delivered_unpaid','cancelled'))`);

    // ── Staff Members ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_members (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        email       VARCHAR(255) UNIQUE,
        phone       VARCHAR(50),
        role        VARCHAR(50) DEFAULT 'kitchen'
                      CHECK (role IN ('kitchen','delivery','manager','cashier','server')),
        shift_start TIME,
        shift_end   TIME,
        is_active   BOOLEAN DEFAULT TRUE,
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Inventory Items ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id                  SERIAL PRIMARY KEY,
        name                VARCHAR(255) NOT NULL,
        category            VARCHAR(100) DEFAULT 'General',
        current_stock       NUMERIC(10,2) DEFAULT 0,
        unit                VARCHAR(50) DEFAULT 'unit',
        low_stock_threshold NUMERIC(10,2) DEFAULT 10,
        cost_per_unit       NUMERIC(10,2) DEFAULT 0,
        supplier            VARCHAR(255),
        notes               TEXT,
        last_restocked_at   TIMESTAMP,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Inventory Restock Log ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_restock_log (
        id           SERIAL PRIMARY KEY,
        item_id      INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
        quantity     NUMERIC(10,2) NOT NULL,
        note         TEXT,
        created_by   VARCHAR(255),
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Delivery Zones ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id            SERIAL PRIMARY KEY,
        location_id   INTEGER REFERENCES locations(id) ON DELETE SET NULL,
        name          VARCHAR(255) NOT NULL,
        min_radius_mi NUMERIC(8,2) DEFAULT 0,
        max_radius_mi NUMERIC(8,2) DEFAULT 5,
        delivery_fee  NUMERIC(10,2) DEFAULT 0,
        is_active     BOOLEAN DEFAULT TRUE,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Notification Broadcasts ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id           SERIAL PRIMARY KEY,
        title        VARCHAR(255) NOT NULL,
        message      TEXT NOT NULL,
        audience     VARCHAR(50) DEFAULT 'all'
                       CHECK (audience IN ('all','customers','subscribers')),
        channels     TEXT[] DEFAULT ARRAY['sms'],
        sent_count   INTEGER DEFAULT 0,
        status       VARCHAR(50) DEFAULT 'draft'
                       CHECK (status IN ('draft','sent','failed')),
        sent_at      TIMESTAMP,
        created_by   VARCHAR(255),
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Mobile App Push Notification Tokens ────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_device_tokens (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
        device_token TEXT NOT NULL UNIQUE,
        device_type  VARCHAR(50) DEFAULT 'web',
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Admin Audit Log ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id          SERIAL PRIMARY KEY,
        admin_id    INTEGER,
        admin_name  VARCHAR(255),
        action      VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id   VARCHAR(100),
        details     JSONB DEFAULT '{}',
        ip_address  VARCHAR(50),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Marketplace Orders (UberEats, GrubHub, Caviar) ────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id                SERIAL PRIMARY KEY,
        platform          VARCHAR(50) NOT NULL,
        platform_order_id VARCHAR(255) UNIQUE,
        status            VARCHAR(50) DEFAULT 'new'
                            CHECK (status IN ('new','accepted','preparing','ready','completed','cancelled')),
        customer_name     VARCHAR(255),
        customer_phone    VARCHAR(50),
        items             JSONB DEFAULT '[]',
        subtotal          NUMERIC(10,2) DEFAULT 0,
        total             NUMERIC(10,2) DEFAULT 0,
        delivery_address  TEXT,
        raw_payload       JSONB DEFAULT '{}',
        placed_at         TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── DoorDash Drive Deliveries ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS doordash_deliveries (
        id                     SERIAL PRIMARY KEY,
        order_id               INTEGER,
        order_number           VARCHAR(100),
        doordash_delivery_id   VARCHAR(255) UNIQUE,
        tracking_url           TEXT,
        status                 VARCHAR(50) DEFAULT 'pending',
        dasher_name            VARCHAR(255),
        dasher_phone           VARCHAR(50),
        estimated_pickup_time  TIMESTAMPTZ,
        estimated_dropoff_time TIMESTAMPTZ,
        fee                    NUMERIC(10,2) DEFAULT 0,
        created_at             TIMESTAMPTZ DEFAULT NOW(),
        updated_at             TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── In-House Delivery Assignments ──────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_assignments (
        id                   SERIAL PRIMARY KEY,
        order_id             INTEGER,
        order_number         VARCHAR(100),
        driver_id            INTEGER REFERENCES staff_members(id) ON DELETE SET NULL,
        driver_name          VARCHAR(255),
        status               VARCHAR(50) DEFAULT 'assigned'
                               CHECK (status IN ('assigned','en_route','delivered','cancelled')),
        delivery_address     TEXT,
        customer_name        VARCHAR(255),
        customer_phone       VARCHAR(50),
        current_lat          NUMERIC(10,7),
        current_lng          NUMERIC(10,7),
        last_location_update TIMESTAMPTZ,
        assigned_at          TIMESTAMPTZ DEFAULT NOW(),
        delivered_at         TIMESTAMPTZ
      );
    `);

    // ── Locations: add accepting_orders column if missing ──────────
    await client.query(`
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN DEFAULT TRUE;
    `);

    // ── Menus: ensure all required columns exist ──────────────────
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_available   BOOLEAN        DEFAULT TRUE`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_active      BOOLEAN        DEFAULT TRUE`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS category       VARCHAR(100)   DEFAULT 'Uncategorized'`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS sort_order     INTEGER        DEFAULT 0`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS partner_price  NUMERIC(10,2)  DEFAULT 0`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS notes          TEXT`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS temperature    VARCHAR(50)`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS choices        JSONB          DEFAULT '[]'`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS addons         JSONB          DEFAULT '[]'`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS dietary_info   JSONB          DEFAULT '{}'`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS available_from  TIME`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS available_until TIME`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_featured     BOOLEAN        DEFAULT FALSE`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS addons_max      INTEGER`);
    await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS categories      TEXT[]         DEFAULT '{}'`);

    // ── Addresses: ensure user_id column exists (bridge column) ────
    await client.query(`
      ALTER TABLE addresses ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);

    // ── Driver Chat Messages ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id           SERIAL PRIMARY KEY,
        order_number VARCHAR(100) NOT NULL,
        sender       VARCHAR(20)  NOT NULL CHECK (sender IN ('customer','driver','system')),
        text         TEXT         NOT NULL,
        created_at   TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_order ON chat_messages(order_number);
    `);
    // Allow 'admin' as a sender (original constraint only had customer/driver/system)
    await client.query(`ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_check`);
    await client.query(`ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_check CHECK (sender IN ('customer','driver','admin','system'))`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read_by_admin BOOLEAN DEFAULT FALSE`);

    // ── Loyalty Config ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_config (
        id           SERIAL PRIMARY KEY,
        earn_rate    NUMERIC(10,2) NOT NULL DEFAULT 10,
        redeem_rate  NUMERIC(10,2) NOT NULL DEFAULT 100,
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`INSERT INTO loyalty_config (id, earn_rate, redeem_rate) VALUES (1, 10, 100) ON CONFLICT (id) DO NOTHING`);

    // ── Roadie Long-Distance Deliveries ───────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS roadie_deliveries (
        id                     SERIAL PRIMARY KEY,
        order_id               INTEGER,
        order_number           VARCHAR(100),
        roadie_id              VARCHAR(255) UNIQUE,
        tracking_number        VARCHAR(255),
        state                  VARCHAR(50)  DEFAULT 'pending',
        price_cents            INTEGER      DEFAULT 0,
        agent_name             VARCHAR(255),
        agent_phone            VARCHAR(50),
        estimated_pickup_time  TIMESTAMPTZ,
        estimated_dropoff_time TIMESTAMPTZ,
        created_at             TIMESTAMPTZ  DEFAULT NOW(),
        updated_at             TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    // ── In-App Notifications ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title      VARCHAR(255) NOT NULL,
        body       TEXT         NOT NULL,
        read       BOOLEAN      DEFAULT FALSE,
        created_at TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_notifications_user
      ON user_notifications(user_id, created_at DESC);
    `);

    // ── Job Vacancies ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_vacancies (
        id            SERIAL PRIMARY KEY,
        title         VARCHAR(255) NOT NULL,
        department    VARCHAR(100),
        location      VARCHAR(255) DEFAULT 'Bronx, NY',
        type          VARCHAR(50)  DEFAULT 'full-time',
        description   TEXT,
        requirements  TEXT,
        salary_range  VARCHAR(100),
        is_active     BOOLEAN      DEFAULT TRUE,
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    // ── Job Applications ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id             SERIAL PRIMARY KEY,
        vacancy_id     INTEGER REFERENCES job_vacancies(id) ON DELETE SET NULL,
        name           VARCHAR(255) NOT NULL,
        email          VARCHAR(255) NOT NULL,
        phone          VARCHAR(50),
        role_applied   VARCHAR(255),
        cover_message  TEXT,
        resume_url     TEXT,
        status         VARCHAR(50)  DEFAULT 'pending'
                         CHECK (status IN ('pending','reviewed','shortlisted','rejected')),
        notes          TEXT,
        created_at     TIMESTAMPTZ  DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    // ── Customer Reviews ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id             SERIAL PRIMARY KEY,
        order_number   VARCHAR(100),
        user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
        customer_name  VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        rating         INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment        TEXT,
        reply          TEXT,
        is_approved    BOOLEAN      DEFAULT FALSE,
        is_featured    BOOLEAN      DEFAULT FALSE,
        created_at     TIMESTAMPTZ  DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS reply       TEXT;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS reviews_approved_idx ON reviews(is_approved);`);
    await client.query(`CREATE INDEX IF NOT EXISTS reviews_rating_idx   ON reviews(rating);`);

    // ── Platform Integration Settings ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id              SERIAL PRIMARY KEY,
        platform        VARCHAR(50) UNIQUE NOT NULL,
        display_name    VARCHAR(100),
        commission_rate NUMERIC(5,2)  DEFAULT 30.00,
        is_active       BOOLEAN       DEFAULT false,
        api_key_set     BOOLEAN       DEFAULT false,
        credentials     JSONB         DEFAULT '{}',
        notes           TEXT,
        last_sync_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ   DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   DEFAULT NOW()
      );
    `);
    // Add credentials column to existing deployments that lack it
    await client.query(`
      ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}';
    `);

    // ── Platform Location Mappings ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_location_mappings (
        id                     SERIAL PRIMARY KEY,
        location_id            INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        platform               VARCHAR(50) NOT NULL,
        platform_store_id      VARCHAR(255),
        platform_restaurant_id VARCHAR(255),
        platform_menu_id       VARCHAR(255),
        is_active              BOOLEAN     DEFAULT false,
        notes                  TEXT,
        created_at             TIMESTAMPTZ DEFAULT NOW(),
        updated_at             TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(location_id, platform)
      );
    `);

    // ── User Favorites ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, menu_item_id)
      );
    `);

    // ── Login brute-force protection ──────────────────────────────
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts     INTEGER   DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_lockout_until TIMESTAMPTZ`);

    // ── Articles / Blog ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        slug        VARCHAR(255) UNIQUE NOT NULL,
        subtitle    VARCHAR(500),
        body        TEXT,
        category    VARCHAR(100)  DEFAULT 'General',
        media_url   TEXT,
        media_type  VARCHAR(10)   DEFAULT 'image',
        is_published BOOLEAN      DEFAULT TRUE,
        sort_order  INT           DEFAULT 0,
        created_at  TIMESTAMPTZ   DEFAULT NOW(),
        updated_at  TIMESTAMPTZ   DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published, created_at DESC);`);

    // ── Build-Your-Own ingredients (bases/cheese/veg/protein/sauce) ──
    // Backs the Custom Order (BYO) builder on the frontend and the "Build
    // Your Own Ingredients" section of the admin Menu Builder. option_key
    // must stay stable — it's the identifier used throughout the BYO
    // pricing/rendering logic and inside stored cart/order JSON.
    await client.query(`
      CREATE TABLE IF NOT EXISTS byo_ingredients (
        id             SERIAL PRIMARY KEY,
        option_key     VARCHAR(50) NOT NULL UNIQUE,
        category       VARCHAR(20) NOT NULL CHECK (category IN ('base','cheese','veg','protein','sauce')),
        label          VARCHAR(100) NOT NULL,
        price          NUMERIC(6,2) NOT NULL DEFAULT 0,
        image_url      VARCHAR(500),
        emoji          VARCHAR(10),
        qty_type       VARCHAR(20),
        family         VARCHAR(20),
        note           VARCHAR(200),
        rim_image_url  VARCHAR(500),
        img_by_qty     JSONB,
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order     INT     NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Widen categories to cover the Build Your Own Bowl preview widget
    // (bowl_base/bowl_topping), and relax uniqueness to (category, option_key)
    // since a key like 'rice' is legitimately used in both 'veg' (sandwich
    // filling) and 'bowl_base' (bowl base) categories.
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE byo_ingredients DROP CONSTRAINT IF EXISTS byo_ingredients_option_key_key;
        ALTER TABLE byo_ingredients DROP CONSTRAINT IF EXISTS byo_ingredients_category_check;
        BEGIN
          ALTER TABLE byo_ingredients ADD CONSTRAINT byo_ingredients_category_check
            CHECK (category IN ('base','cheese','veg','protein','sauce','bowl_base','bowl_topping','bowl_protein','bowl_sauce'));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TABLE byo_ingredients ADD CONSTRAINT byo_ingredients_category_option_key_key
            UNIQUE (category, option_key);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);

    // ── Global Addon Groups (Sauces, Make it a Meal!, Add a Drink) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_addon_groups (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        options    JSONB NOT NULL DEFAULT '[]',
        sort_order INT           DEFAULT 0,
        is_active  BOOLEAN       DEFAULT TRUE
      );
    `);
    await client.query(`
      ALTER TABLE menus ADD COLUMN IF NOT EXISTS exclude_global_addons BOOLEAN DEFAULT FALSE;
    `);

    // ── Site Settings (admin-editable business info) ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id                INTEGER PRIMARY KEY DEFAULT 1,
        phone_main        VARCHAR(50)  DEFAULT '(718) 400-0443',
        phone_tollfree    VARCHAR(50)  DEFAULT '(888) 887-5571',
        phone_fax         VARCHAR(50)  DEFAULT '(718) 400-0442',
        email_contact     VARCHAR(100) DEFAULT 'admin@habibihe.com',
        email_orders      VARCHAR(100) DEFAULT 'orders@habibihe.com',
        address_street    VARCHAR(255) DEFAULT '2974 Jerome Ave',
        address_city      VARCHAR(100) DEFAULT 'Bronx',
        address_state     VARCHAR(50)  DEFAULT 'NY',
        address_zip       VARCHAR(20)  DEFAULT '10468',
        social_instagram  VARCHAR(255) DEFAULT '',
        social_facebook   VARCHAR(255) DEFAULT '',
        social_twitter    VARCHAR(255) DEFAULT '',
        social_tiktok     VARCHAR(255) DEFAULT '',
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("✅ All tables created/verified");

    // ── delivery_assignments: new columns for proof, tip, GPS trail, accept/reject ──
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS tip_amount       NUMERIC(10,2)`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS gps_trail        JSONB        DEFAULT '[]'`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS accepted_at      TIMESTAMPTZ`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS proof_photo_url  TEXT`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS proof_note       TEXT`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivery_note    TEXT`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS cash_collected_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS cash_collected_by VARCHAR(100)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_cash_handins (
        id           SERIAL PRIMARY KEY,
        driver_id    INTEGER,
        driver_name  VARCHAR(100),
        amount       NUMERIC(10,2) NOT NULL,
        order_count  INTEGER DEFAULT 0,
        confirmed_by VARCHAR(100),
        notes        TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_status_check`);
    await client.query(`ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_assignments_status_check CHECK (status IN ('assigned','en_route','delivered','cancelled'))`);

    // ── staff_members: on-duty toggle + driver PIN + FCM push token ──
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS is_on_duty          BOOLEAN      DEFAULT FALSE`);
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS driver_pin_hash     VARCHAR(100)`);
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS driver_pin_attempts INTEGER      DEFAULT 0`);
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS driver_pin_lockout_until TIMESTAMPTZ`);
    await client.query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS driver_fcm_token    TEXT`);

    // ── driver_messages: driver ↔ dispatch chat ───────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_messages (
        id          SERIAL PRIMARY KEY,
        driver_id   INTEGER NOT NULL,
        driver_name TEXT,
        message     TEXT NOT NULL,
        direction   VARCHAR(10) NOT NULL DEFAULT 'inbound',
        sent_by     TEXT,
        read_at     TIMESTAMPTZ,
        sent_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_driver_messages_driver ON driver_messages(driver_id, sent_at DESC)`);

    // ── Seed default data (only if tables are empty) ──────────────
    await seedDefaults();

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating tables:", error.message);
    throw error;
  } finally {
    client.release();
  }
};

const seedDefaults = async () => {
  // Seed delivery tiers
  const tierCount = await pool.query("SELECT COUNT(*) FROM delivery_tiers");
  if (parseInt(tierCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO delivery_tiers (label, min_distance, max_distance, provider_type, is_active) VALUES
        ('In-House Delivery',    0,    5,   'in_house',    TRUE),
        ('DoorDash Drive',       5,    30,  'doordash',    TRUE),
        ('Roadie Express',       30,   150, 'roadie',      TRUE),
        ('Roadie Long Distance', 150,  350, 'roadie',      TRUE),
        ('Pickup Only',          350,  9999,'pickup_only', TRUE)
    `);
    console.log("✅ Default delivery tiers seeded");
  }

  // Seed admin sidebar
  const sidebarCount = await pool.query("SELECT COUNT(*) FROM admin_sidebar");
  if (parseInt(sidebarCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO admin_sidebar (title, icon, route, sort_order) VALUES
        ('Dashboard',         'LayoutDashboard', '/admin',                1),
        ('Orders',            'ShoppingBag',     '/admin/orders',         2),
        ('Menu Manager',      'UtensilsCrossed', '/admin/menu',           3),
        ('Locations',         'MapPin',          '/admin/locations',      4),
        ('Customers',         'Users',           '/admin/customers',      5),
        ('Coupons',           'Tag',             '/admin/coupons',        6),
        ('Reports',           'BarChart2',       '/admin/reports',        7),
        ('Delivery Partners', 'Truck',           '/admin/delivery',       8),
        ('Business Partners', 'Handshake',       '/admin/partners',       9),
        ('Staff',             'BadgeCheck',      '/admin/staff',         10),
        ('Settings',          'Settings',        '/admin/settings',      11)
    `);
    console.log("✅ Admin sidebar seeded");
  }

  // Seed locations
  const locCount = await pool.query("SELECT COUNT(*) FROM locations");
  if (parseInt(locCount.rows[0].count) === 0) {
    // Only 3 real locations — keep in sync with production by hand if it ever changes.
    await pool.query(`
      INSERT INTO locations (title, brief_address, exact_address, phone_number, working_days_hours, is_active, preference_level, delivery_radius_miles, latitude, longitude, image_url) VALUES
        ('Bedford Park & Jerome Ave', 'Bronx, NY 10458', '204 E Mosholu Pkwy S, Bronx, NY 10458', '(718) 367-7878', 'Open 24 Hours · 365 Days a Year', TRUE, 5, 5.0, 40.8726,    -73.8901,    '/images/locations/bedford-park.webp'),
        ('Kingsbridge Road',          'Bronx, NY 10468', '2 E Kingsbridge Rd, Bronx, NY 10468',    '(718) 367-7879', 'Mon–Sun: 7AM – 11PM',             TRUE, 4, 4.0, 40.8672738, -73.8972187, '/images/locations/kings-bridge.webp'),
        ('White Plains Road',         'Bronx, NY 10466', '3971 White Plains Rd, Bronx, NY 10466',  '(718) 367-7880', 'Mon–Fri: 6AM – 10PM',             TRUE, 3, 4.0, 40.887949,  -73.860493,  '/images/locations/white-plains.webp')
    `);
    console.log("✅ Default locations seeded");
  } else {
    // Backfill image_url for existing rows that were seeded without it
    await pool.query(`UPDATE locations SET image_url='/images/locations/bedford-park.webp'  WHERE LOWER(title) LIKE '%bedford%'     AND (image_url IS NULL OR image_url='')`);
    await pool.query(`UPDATE locations SET image_url='/images/locations/kings-bridge.webp'  WHERE LOWER(title) LIKE '%kingsbridge%' AND (image_url IS NULL OR image_url='')`);
    await pool.query(`UPDATE locations SET image_url='/images/locations/white-plains.webp'  WHERE LOWER(title) LIKE '%white plains%' AND (image_url IS NULL OR image_url='')`);
  }

  // ── Referrals ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id              SERIAL PRIMARY KEY,
      referrer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referee_email   VARCHAR(255),
      referee_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status          VARCHAR(20)  DEFAULT 'pending' CHECK (status IN ('pending','completed','expired')),
      referral_code   VARCHAR(20)  NOT NULL,
      points_awarded  INTEGER DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    )
  `);

  // ── Group Order Sessions ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_order_sessions (
      id           SERIAL PRIMARY KEY,
      session_id   VARCHAR(20)  UNIQUE NOT NULL,
      join_code    VARCHAR(8)   UNIQUE NOT NULL,
      host_name    VARCHAR(100) NOT NULL,
      host_user_id INTEGER      REFERENCES users(id) ON DELETE SET NULL,
      status       VARCHAR(20)  DEFAULT 'open' CHECK (status IN ('open', 'locked', 'closed')),
      expires_at   TIMESTAMPTZ  NOT NULL,
      created_at   TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_order_participants (
      id             SERIAL PRIMARY KEY,
      session_id     VARCHAR(20)  NOT NULL REFERENCES group_order_sessions(session_id) ON DELETE CASCADE,
      participant_id VARCHAR(36)  NOT NULL,
      name           VARCHAR(100) NOT NULL,
      is_host        BOOLEAN      DEFAULT FALSE,
      joined_at      TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE(session_id, participant_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_order_items (
      id             SERIAL PRIMARY KEY,
      session_id     VARCHAR(20)   NOT NULL,
      participant_id VARCHAR(36)   NOT NULL,
      menu_item_id   INTEGER,
      name           VARCHAR(200)  NOT NULL,
      price          NUMERIC(10,2) NOT NULL,
      qty            INTEGER       NOT NULL DEFAULT 1,
      note           TEXT,
      details        JSONB,
      added_at       TIMESTAMPTZ   DEFAULT NOW()
    )
  `);
  // Carries each item's full addon/choice breakdown so checkout can rebuild the exact cart line
  // (older rows simply have details = NULL and fall back to the flat name/price/qty/note).
  await pool.query(`ALTER TABLE group_order_items ADD COLUMN IF NOT EXISTS details JSONB`);

  // Seed categories
  const catCount = await pool.query("SELECT COUNT(*) FROM categories");
  if (parseInt(catCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO categories (name, preference) VALUES
        ('Breakfast',     1),
        ('Platter',       2),
        ('Sandwich',      3),
        ('Tacos',         4),
        ('Build Your Own',5),
        ('Extras',        6)
    `);
    console.log("✅ Default categories seeded");
  }

  // Seed platform integration settings
  const psIntCount = await pool.query("SELECT COUNT(*) FROM platform_settings");
  if (parseInt(psIntCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO platform_settings (platform, display_name, commission_rate, is_active, api_key_set) VALUES
        ('ubereats',  'Uber Eats',  30.00, false, false),
        ('grubhub',   'GrubHub',    25.00, false, false),
        ('doordash',  'DoorDash',   15.00, false, false),
        ('caviar',    'Caviar',     15.00, false, false)
    `);
    console.log("✅ Default platform settings seeded");
  }

  // Seed global addon groups (Sauces, Make it a Meal!, Add a Drink)
  const globalAddonCount = await pool.query("SELECT COUNT(*) FROM global_addon_groups");
  if (parseInt(globalAddonCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO global_addon_groups (name, options, sort_order) VALUES
      ('Sauces', '[
        {"id":9001,"title":"White Sauce","price":0.50},
        {"id":9002,"title":"Hot Sauce","price":0.50},
        {"id":9003,"title":"Ketchup","price":0.50},
        {"id":9004,"title":"Mustard","price":0.50},
        {"id":9005,"title":"BBQ Sauce","price":0.50},
        {"id":9006,"title":"Special Green Sauce","price":0.50},
        {"id":9007,"title":"Mayonnaise","price":0.75},
        {"id":9008,"title":"Blue Cheese","price":1.00}
      ]', 1),
      ('Make it a Meal!', '[
        {"id":9101,"title":"French Fries","price":2.00},
        {"id":9102,"title":"Pita Bread","price":1.00},
        {"id":9103,"title":"Extra Rice","price":2.00},
        {"id":9104,"title":"Add 4 Falafel with White Sauce","price":2.25},
        {"id":9105,"title":"Add 3 Pieces of Samosa","price":2.50},
        {"id":9106,"title":"Extra Three Wings (Same Sauce)","price":2.50},
        {"id":9107,"title":"Extra Three Wings Plain","price":2.50},
        {"id":9108,"title":"Extra Three Buffalo Wings","price":2.50},
        {"id":9109,"title":"Extra Three BBQ Wings","price":2.50},
        {"id":9110,"title":"Extra Meat","price":2.50}
      ]', 2),
      ('Add a Drink', '[
        {"id":9201,"title":"Bottle of Water","price":1.00},
        {"id":9202,"title":"Can of Soda (Pepsi)","price":1.00},
        {"id":9203,"title":"Can of Soda (Diet Pepsi)","price":1.00},
        {"id":9204,"title":"Can of Soda (Coke)","price":1.00},
        {"id":9205,"title":"Can of Soda (Orange)","price":1.00},
        {"id":9206,"title":"Can of Soda (Sprite)","price":1.00},
        {"id":9207,"title":"Can of Soda (Ginger Ale)","price":1.00},
        {"id":9208,"title":"Can of Soda (Iced Tea)","price":1.00},
        {"id":9209,"title":"Snapple (Apple)","price":2.00},
        {"id":9210,"title":"Snapple (Lemon Tea)","price":2.50},
        {"id":9211,"title":"Snapple (Peach)","price":2.50},
        {"id":9212,"title":"Gatorade (Apple)","price":2.50},
        {"id":9213,"title":"Gatorade (Lemon Tea)","price":2.50},
        {"id":9214,"title":"Gatorade (Peach)","price":2.50},
        {"id":9215,"title":"Gatorade (Berry)","price":2.50},
        {"id":9216,"title":"Orange Juice","price":2.50},
        {"id":9217,"title":"Apple Juice","price":2.50},
        {"id":9218,"title":"Cranberry Juice","price":2.50},
        {"id":9219,"title":"Pineapple Juice","price":2.50}
      ]', 3)
    `);
    console.log("✅ Default global addon groups seeded");
  }

  // Seed Build-Your-Own ingredients (bases/cheese/veg/protein/sauce)
  const byoCount = await pool.query("SELECT COUNT(*) FROM byo_ingredients");
  if (parseInt(byoCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO byo_ingredients
        (option_key, category, label, price, image_url, emoji, qty_type, family, note, rim_image_url, img_by_qty, sort_order)
      VALUES
        ('39a', 'base', 'Hero', 1.99, '/images/byo/bases/39a.webp', NULL, NULL, 'hero', NULL, NULL, NULL, 1),
        ('39b', 'base', 'Wrap', 1.99, '/images/byo/bases/39b.webp', NULL, NULL, 'wrap', 'Habibi Special Wrap', NULL, NULL, 2),
        ('39c', 'base', 'Pita Bread', 1.99, '/images/byo/bases/39c.webp', NULL, NULL, 'wrap', NULL, NULL, NULL, 3),
        ('39d', 'base', 'Croissant', 1.99, '/images/byo/bases/39d.webp', NULL, NULL, 'compact', NULL, NULL, NULL, 4),
        ('39e', 'base', 'Bagel', 1.99, '/images/byo/bases/39e.webp', NULL, NULL, 'standard', NULL, NULL, NULL, 5),
        ('39f', 'base', 'Roll', 1.49, '/images/byo/bases/39f.webp', NULL, NULL, 'standard', NULL, NULL, NULL, 6),
        ('39g', 'base', 'Burger Bun', 1.99, '/images/byo/bases/39g.webp', NULL, NULL, 'standard', NULL, NULL, NULL, 7),
        ('39h', 'base', 'Hot Dog Bun', 0.99, '/images/byo/bases/39h.webp', NULL, NULL, 'compact', NULL, NULL, NULL, 8),
        ('39i', 'base', 'Platter', 2.99, '/images/byo/bases/39i.webp', NULL, NULL, 'platter', NULL, '/images/byo/bases/39i-rim.webp', NULL, 9),
        ('39j', 'base', 'Family Tray', 4.99, '/images/byo/bases/39j.webp', NULL, NULL, 'familyTray', NULL, '/images/byo/bases/39j-rim.webp', NULL, 10),
        ('none', 'cheese', 'No Cheese', 0, NULL, '⬜', NULL, NULL, NULL, NULL, NULL, 11),
        ('american', 'cheese', 'American Cheese', 1, '/images/byo/ing/american-cheese.webp', '🧀', NULL, NULL, NULL, NULL, NULL, 12),
        ('butter', 'cheese', 'Butter', 2, '/images/byo/ing/butter2.webp', '🫙', NULL, NULL, NULL, NULL, NULL, 13),
        ('liquid_cheese', 'cheese', 'Cream Cheese', 1.5, '/images/byo/ing/liquid-cheese.webp', '🫕', NULL, NULL, NULL, NULL, NULL, 14),
        ('onions', 'veg', 'Onions', 0.5, '/images/byo/ing/onion2.webp', '🧅', NULL, NULL, NULL, NULL, NULL, 15),
        ('peppers', 'veg', 'Green Peppers', 0.5, '/images/byo/ing/pepper.webp', '🌿', NULL, NULL, NULL, NULL, NULL, 16),
        ('cucumbers', 'veg', 'Cucumbers', 0.5, '/images/byo/ing/cucumber2.webp', '🥒', NULL, NULL, NULL, NULL, NULL, 17),
        ('lettuce', 'veg', 'Lettuce', 0.5, '/images/byo/ing/lettuce.webp', '🥬', NULL, NULL, NULL, NULL, NULL, 18),
        ('tomatoes', 'veg', 'Tomatoes', 0.5, '/images/byo/ing/tomato.webp', '🍅', NULL, NULL, NULL, NULL, NULL, 19),
        ('rice', 'veg', 'Rice', 2, '/images/byo/ing/rice.webp', '🍚', NULL, NULL, NULL, NULL, NULL, 20),
        ('egg-fried', 'protein', 'Egg (Fried)', 1, '/images/byo/ing/egg-fried.webp', NULL, 'eggs', NULL, NULL, NULL, NULL, 21),
        ('egg-scrambled', 'protein', 'Egg (Scrambled)', 1, '/images/byo/ing/egg-scrambled.webp', NULL, 'eggs', NULL, NULL, NULL, NULL, 22),
        ('chicken', 'protein', 'Chicken Broasted', 6, '/images/byo/ing/chicken-broasted.webp', NULL, 'low-extra', NULL, NULL, NULL, NULL, 23),
        ('lamb-gyro', 'protein', 'Lamb Gyro', 6, '/images/byo/ing/lamb-gyro.webp', NULL, 'low-extra', NULL, NULL, NULL, NULL, 24),
        ('mix', 'protein', 'Mix', 7, '/images/byo/ing/mix.webp', NULL, 'low-extra', NULL, NULL, NULL, NULL, 25),
        ('hotdog', 'protein', 'Hot Dog', 2, '/images/byo/ing/hotdog.webp', NULL, 'single-double', NULL, NULL, NULL, NULL, 26),
        ('bacon', 'protein', 'Bacon', 3, '/images/byo/ing/bacon.webp', NULL, 'low-extra', NULL, 'Beef bacon, halal', NULL, NULL, 27),
        ('hot-sausage', 'protein', 'Hot Sausage', 3, '/images/byo/ing/hot-sausage.webp', NULL, 'single-double', NULL, NULL, NULL, NULL, 28),
        ('italian-sausage', 'protein', 'Italian Sausage', 6, '/images/byo/ing/italian-sausage.webp', NULL, 'single-double', NULL, NULL, NULL, NULL, 29),
        ('turkey', 'protein', 'Turkey', 6, '/images/byo/ing/turkey.webp', NULL, 'low-extra', NULL, NULL, NULL, NULL, 30),
        ('chicken-kabab', 'protein', 'Chicken Shish Kabab', 3, '/images/byo/ing/chicken-kabab.webp', NULL, 'single-triple', NULL, NULL, NULL, NULL, 31),
        ('beef-kabab', 'protein', 'Beef Shish Kabab', 4, '/images/byo/ing/beef-kabab.webp', NULL, 'single-triple', NULL, NULL, NULL, NULL, 32),
        ('philly-steak', 'protein', 'Philly Steak', 6, '/images/byo/ing/philly-steak.webp', NULL, 'single-double', NULL, NULL, NULL, NULL, 33),
        ('falafel', 'protein', 'Falafel', 6, '/images/byo/ing/falafel-6.webp', NULL, 'low-extra', NULL, NULL, NULL, '{"low":"/images/byo/ing/falafel-3.webp","regular":"/images/byo/ing/falafel-6.webp","extra":"/images/byo/ing/falafel-9.webp","double":"/images/byo/ing/falafel-12.webp"}'::jsonb, 34),
        ('fish-fillet', 'protein', 'Fish Fillet', 7, '/images/byo/ing/fish-fillet2.webp', NULL, 'single-double', NULL, NULL, NULL, NULL, 35),
        ('shrimp', 'protein', 'Shrimp', 8, '/images/byo/ing/shrimp.webp', NULL, 'low-extra', NULL, NULL, NULL, NULL, 36),
        ('tuna', 'protein', 'Tuna Fish', 7, '/images/byo/ing/tuna.webp', NULL, 'low-extra', NULL, NULL, NULL, NULL, 37),
        ('beef-burger', 'protein', 'Beef Berger', 5, '/images/byo/ing/beef-burger2.webp', NULL, 'single-double', NULL, NULL, NULL, NULL, 38),
        ('chicken-burger', 'protein', 'Chicken Berger', 5, '/images/byo/ing/chicken-burger.webp', NULL, 'single-double', NULL, NULL, NULL, NULL, 39),
        ('white', 'sauce', 'White Sauce', 1, '/images/byo/ing/sauce-white-bowl.webp', NULL, NULL, NULL, NULL, NULL, NULL, 40),
        ('hot', 'sauce', 'Hot Sauce', 1, '/images/byo/ing/sauce-hot-bowl.webp', NULL, NULL, NULL, NULL, NULL, NULL, 41),
        ('ketchup', 'sauce', 'Ketchup', 0.75, '/images/byo/ing/sauce-ketchup.webp', NULL, NULL, NULL, NULL, NULL, NULL, 42),
        ('mustard', 'sauce', 'Mustard', 0.75, '/images/byo/ing/sauce-mustard.webp', NULL, NULL, NULL, NULL, NULL, NULL, 43),
        ('bbq', 'sauce', 'BBQ Sauce', 1, '/images/byo/ing/sauce-bbq.webp', NULL, NULL, NULL, NULL, NULL, NULL, 44),
        ('green', 'sauce', 'Special Green Sauce', 1.25, '/images/byo/ing/sauce-green.webp', NULL, NULL, NULL, NULL, NULL, NULL, 45),
        ('mayo', 'sauce', 'Mayonnaise', 0.75, '/images/byo/ing/sauce-mayo.webp', NULL, NULL, NULL, NULL, NULL, NULL, 46),
        ('blue', 'sauce', 'Blue Cheese', 1.25, '/images/byo/ing/sauce-blue-cheese.webp', NULL, NULL, NULL, NULL, NULL, NULL, 47)
    `);
    console.log("✅ Default BYO ingredients seeded");
  }

  // Seed Build Your Own Bowl preview widget options (separate check since the
  // main byo_ingredients seed above only runs once, before these existed)
  const bowlCount = await pool.query("SELECT COUNT(*) FROM byo_ingredients WHERE category IN ('bowl_base','bowl_topping')");
  if (parseInt(bowlCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO byo_ingredients
        (option_key, category, label, price, image_url, sort_order)
      VALUES
        ('rice',     'bowl_base',    'Rice',     2.00, '/images/byo/ing/rice.jpg',    1),
        ('hummus',   'bowl_base',    'Hummus',   2.50, '/images/byo/ing/hummus.webp', 2),
        ('salad',    'bowl_base',    'Salad',    2.00, '/images/byo/ing/lettuce.webp',3),
        ('lettuce',  'bowl_topping', 'Lettuce',  0.50, '/images/byo/ing/lettuce.webp', 1),
        ('tomato',   'bowl_topping', 'Tomato',   0.50, '/images/byo/ing/tomato.webp',  2),
        ('cucumber', 'bowl_topping', 'Cucumber', 0.50, '/images/byo/ing/cucumber.webp',3),
        ('onion',    'bowl_topping', 'Onion',    0.50, '/images/byo/ing/onion.webp',   4)
    `);
    console.log("✅ Default Build Your Own Bowl options seeded");
  }

  // Bowl Protein / Bowl Sauce — the BYO Bowl preview widget uses its own
  // small curated list here (not the full 19 proteins / 8 sauces used by
  // the /customize sandwich builder), same option_keys as their sandwich
  // counterparts but a separate category so admin can manage this smaller
  // set independently.
  const bowlProteinSauceCount = await pool.query("SELECT COUNT(*) FROM byo_ingredients WHERE category IN ('bowl_protein','bowl_sauce')");
  if (parseInt(bowlProteinSauceCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO byo_ingredients
        (option_key, category, label, price, image_url, sort_order)
      VALUES
        ('chicken',    'bowl_protein', 'Chicken Broasted',  6.00, '/images/byo/ing/chicken-broasted.webp', 1),
        ('lamb-gyro',  'bowl_protein', 'Lamb Gyro',         6.00, '/images/byo/ing/lamb-gyro.webp',         2),
        ('beef-kabab', 'bowl_protein', 'Beef Shish Kabab',  4.00, '/images/byo/ing/beef-kabab.webp',        3),
        ('falafel',    'bowl_protein', 'Falafel',           6.00, '/images/byo/ing/falafel-6.webp',         4),
        ('white',      'bowl_sauce',   'White Sauce',       1.00, '/images/byo/ing/sauce-white-bowl.webp',  1),
        ('hot',        'bowl_sauce',   'Hot Sauce',         1.00, '/images/byo/ing/sauce-hot-bowl.webp',    2),
        ('bbq',        'bowl_sauce',   'BBQ Sauce',         1.00, '/images/byo/ing/sauce-bbq.webp',         3)
    `);
    console.log("✅ Default Bowl Protein / Bowl Sauce options seeded");
  }

  // Seed payment settings
  const psCount = await pool.query("SELECT COUNT(*) FROM payment_settings");
  if (parseInt(psCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO payment_settings (label, provider, is_active) VALUES
        ('Credit / Debit Card', 'square',  TRUE),
        ('Apple Pay',           'square',  TRUE),
        ('Google Pay',          'square',  TRUE),
        ('PayPal',              'paypal',  FALSE),
        ('Cash on Delivery',    'cash',    TRUE)
    `);
    console.log("✅ Default payment settings seeded");
  }

  // ── Authorize.net merchant accounts ────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS authorize_net_accounts (
      id              SERIAL PRIMARY KEY,
      nickname        VARCHAR(100) NOT NULL,
      api_login_id    VARCHAR(100) NOT NULL,
      transaction_key VARCHAR(100) NOT NULL,
      client_key      VARCHAR(255),
      environment     VARCHAR(20) DEFAULT 'production'
                        CHECK (environment IN ('sandbox', 'production')),
      is_active       BOOLEAN DEFAULT FALSE,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default admin user — password MUST be supplied via SEED_ADMIN_PASSWORD env var
  const adminCheck = await pool.query("SELECT id FROM users WHERE email = $1", ['admin@habibihe.com']);
  if (adminCheck.rows.length === 0) {
    const seedPwd = process.env.SEED_ADMIN_PASSWORD;
    if (!seedPwd || seedPwd.length < 12) {
      console.warn("⚠️  SEED_ADMIN_PASSWORD not set or too short — skipping admin seed. Set it in .env to create the default admin.");
    } else {
      const hash = await bcrypt.hash(seedPwd, 12);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, email_verified) VALUES ($1, $2, $3, 'admin', TRUE)`,
        ['Habibi Admin', 'admin@habibihe.com', hash]
      );
      console.log("✅ Default admin user created — admin@habibihe.com (password from SEED_ADMIN_PASSWORD)");
    }
  }
};

module.exports = createTables;
