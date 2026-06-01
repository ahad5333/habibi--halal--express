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
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified       BOOLEAN DEFAULT FALSE`);

    // ── Coupons: safe migration columns ───────────────────────────
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS title              VARCHAR(255)`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description        TEXT`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_from         TIMESTAMPTZ`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_until        TIMESTAMPTZ`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_email     VARCHAR(255)`);
    await client.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS location_id        INTEGER REFERENCES locations(id) ON DELETE SET NULL`);

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
        order_status          VARCHAR(50)  DEFAULT 'pending',
        items                 JSONB        DEFAULT '[]',
        placed_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
    await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)`);

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
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        brand      VARCHAR(50),
        last4      VARCHAR(4),
        expiry     VARCHAR(10),
        token      VARCHAR(255),
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // ── Device tokens (push notifications) ────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_device_tokens (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
        device_token TEXT        NOT NULL UNIQUE,
        device_type  VARCHAR(10),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);

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

    await client.query("COMMIT");
    console.log("✅ All tables created/verified");

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
        ('In-House Delivery',   0,   3,   'in_house',  TRUE),
        ('Express Delivery',    3,   10,  'doordash',  TRUE),
        ('Long Distance',       10,  50,  'roadie',    TRUE),
        ('Super Long Distance', 50,  500, 'roadie',    FALSE)
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
    await pool.query(`
      INSERT INTO locations (title, brief_address, exact_address, phone_number, working_days_hours, is_active, preference_level, delivery_radius_miles, latitude, longitude, image_url) VALUES
        ('Bedford Park & Jerome Ave',      'Bronx, NY 10458', '204 E Mosholu Pkwy S, Bronx, NY 10458',           '(718) 367-7878', 'Open 24 Hours · 365 Days a Year', TRUE, 5, 5.0, 40.8726, -73.8901, '/images/locations/bedford-park.jpg'),
        ('Lehman College Area',            'Bronx, NY 10468', '250 Bedford Park Blvd W, Bronx, NY 10468',        '(718) 367-7879', 'Mon–Sun: 7AM – 11PM',             TRUE, 4, 4.0, 40.8731, -73.8967, '/images/hero_dining_ambiance.jpg'),
        ('Bronx High School of Science',   'Bronx, NY 10468', '75 W 205th St, Bronx, NY 10468',                  '(718) 367-7880', 'Mon–Fri: 6AM – 10PM',             TRUE, 3, 4.0, 40.8744, -73.8989, '/images/chef-plating.jpg'),
        ('Kingsbridge Road & Jerome Ave',  'Bronx, NY 10458', '3521 Jerome Ave, Bronx, NY 10467',                '(718) 367-7881', 'Mon–Sun: 7AM – 12AM',             TRUE, 2, 4.5, 40.8785, -73.8925, '/images/locations/kings-bridge.jpg'),
        ('White Plains Road',              'Bronx, NY 10462', '1892 White Plains Rd, Bronx, NY 10462',           '(718) 367-7882', 'Mon–Sun: 8AM – 11PM',             TRUE, 1, 4.0, 40.8401, -73.8593, '/images/locations/white-plains.jpg')
    `);
    console.log("✅ Default locations seeded");
  } else {
    // Backfill image_url for existing rows that were seeded without it
    await pool.query(`UPDATE locations SET image_url='/images/locations/bedford-park.jpg'  WHERE LOWER(title) LIKE '%bedford%'    AND (image_url IS NULL OR image_url='')`);
    await pool.query(`UPDATE locations SET image_url='/images/locations/kings-bridge.jpg'  WHERE LOWER(title) LIKE '%kingsbridge%' AND (image_url IS NULL OR image_url='')`);
    await pool.query(`UPDATE locations SET image_url='/images/locations/white-plains.jpg'  WHERE LOWER(title) LIKE '%white plains%' AND (image_url IS NULL OR image_url='')`);
    await pool.query(`UPDATE locations SET image_url='/images/hero_dining_ambiance.jpg'    WHERE LOWER(title) LIKE '%lehman%'      AND (image_url IS NULL OR image_url='')`);
    await pool.query(`UPDATE locations SET image_url='/images/chef-plating.jpg'            WHERE LOWER(title) LIKE '%science%'     AND (image_url IS NULL OR image_url='')`);
  }

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

  // Seed default admin user
  const adminCheck = await pool.query("SELECT id FROM users WHERE email = $1", ['admin@habibihe.com']);
  if (adminCheck.rows.length === 0) {
    const hash = await bcrypt.hash('Habibi@Admin2025', 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      ['Habibi Admin', 'admin@habibihe.com', hash]
    );
    console.log("✅ Default admin user created — admin@habibihe.com / Habibi@Admin2025");
  }
};

module.exports = createTables;
