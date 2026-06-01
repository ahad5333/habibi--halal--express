-- Habibi Halal Express — Full Database Schema
-- Run as: psql -d habibidb -f schema.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','merchant','admin','business','driver')),
    is_active BOOLEAN DEFAULT true,
    is_partner BOOLEAN DEFAULT false,
    partner_id INTEGER,
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    loyalty_points INTEGER DEFAULT 0,
    avatar_url TEXT,
    provider VARCHAR(50),
    provider_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    business_name VARCHAR(255),
    date_of_birth DATE,
    receive_sms_updates BOOLEAN DEFAULT true,
    receive_promotions BOOLEAN DEFAULT false,
    last_login TIMESTAMP
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    brief_address VARCHAR(255),
    exact_address TEXT,
    phone_number VARCHAR(20),
    image_url TEXT,
    working_days_hours TEXT,
    holidays TEXT,
    is_active BOOLEAN DEFAULT true,
    accepting_orders BOOLEAN DEFAULT true,
    preference_level INTEGER DEFAULT 0,
    location_note TEXT,
    self_delivery_enabled BOOLEAN DEFAULT true,
    delivery_radius_miles INTEGER DEFAULT 10,
    delivery_cost DECIMAL(10,2) DEFAULT 0,
    delivery_per_mile_fee DECIMAL(10,2) DEFAULT 0,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_name VARCHAR(200) NOT NULL,
    street_address VARCHAR(255) NOT NULL,
    second_line VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    driver_instruction TEXT,
    is_default BOOLEAN DEFAULT false,
    is_gift_order BOOLEAN DEFAULT false,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    image_url TEXT,
    preference INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    price DECIMAL(10,2) NOT NULL,
    partner_price DECIMAL(10,2),
    category_id INTEGER REFERENCES categories(id),
    preference INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Choice Groups (radio options)
CREATE TABLE IF NOT EXISTS choice_groups (
    id SERIAL PRIMARY KEY,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    preference INTEGER DEFAULT 0
);

-- Choice Options
CREATE TABLE IF NOT EXISTS choice_options (
    id SERIAL PRIMARY KEY,
    choice_group_id INTEGER REFERENCES choice_groups(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    extra_price DECIMAL(10,2) DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    preference INTEGER DEFAULT 0
);

-- Addon Groups
CREATE TABLE IF NOT EXISTS addon_groups (
    id SERIAL PRIMARY KEY,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    preference INTEGER DEFAULT 0
);

-- Addon Options
CREATE TABLE IF NOT EXISTS addon_options (
    id SERIAL PRIMARY KEY,
    addon_group_id INTEGER REFERENCES addon_groups(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    preference INTEGER DEFAULT 0
);

-- Menu Item Locations (which items are available at which locations)
CREATE TABLE IF NOT EXISTS menu_item_locations (
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, location_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    location_id INTEGER REFERENCES locations(id),
    address_id INTEGER REFERENCES addresses(id),
    delivery_method VARCHAR(50) DEFAULT 'delivery',
    scheduled_time TIMESTAMP,
    sub_total DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    service_fee DECIMAL(10,2) DEFAULT 0,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    tip DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
    order_status VARCHAR(50) DEFAULT 'received' CHECK (order_status IN ('received','preparing','ready','picked_up','delivered','cancelled')),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(20),
    driver_photo TEXT,
    delivery_partner VARCHAR(100),
    assigned_driver_id INTEGER,
    driver_location_lat DECIMAL(10,8),
    driver_location_lng DECIMAL(11,8),
    special_notes TEXT,
    coupon_code VARCHAR(50),
    loyalty_points_redeemed INTEGER DEFAULT 0,
    table_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    selected_choices JSONB,
    addons JSONB,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Status History
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guest Orders
CREATE TABLE IF NOT EXISTS guest_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    delivery_method VARCHAR(50),
    delivery_address TEXT,
    delivery_city VARCHAR(100),
    delivery_state VARCHAR(50),
    delivery_zip VARCHAR(10),
    delivery_instructions TEXT,
    payment_method VARCHAR(50),
    sub_total DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    service_fee DECIMAL(10,2) DEFAULT 0,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    tip DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    coupon_code VARCHAR(50),
    expected_time VARCHAR(100),
    order_status VARCHAR(50) DEFAULT 'received',
    items JSONB,
    loyalty_points_redeemed INTEGER DEFAULT 0,
    table_number VARCHAR(20),
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carts
CREATE TABLE IF NOT EXISTS carts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cart Items
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
    menu_item_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2),
    selected_choices JSONB,
    addons JSONB,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255),
    description TEXT,
    condition_type VARCHAR(50),
    condition_value JSONB,
    discount_type VARCHAR(50),
    discount_value DECIMAL(10,2),
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2),
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    expiry_date TIMESTAMP,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_first_order_only BOOLEAN DEFAULT false,
    is_bogo BOOLEAN DEFAULT false,
    customer_email VARCHAR(255),
    location_id INTEGER,
    target_product_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    token VARCHAR(255),
    last_four VARCHAR(4),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50),
    title VARCHAR(255),
    body TEXT,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Notifications (in-app)
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    body TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Device Tokens (push notifications)
CREATE TABLE IF NOT EXISTS user_device_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT UNIQUE NOT NULL,
    device_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100),
    user_id INTEGER REFERENCES users(id),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    reply TEXT,
    is_approved BOOLEAN DEFAULT false,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dine-In Tables
CREATE TABLE IF NOT EXISTS dine_in_tables (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    qr_slug VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) NOT NULL,
    sender VARCHAR(20) CHECK (sender IN ('customer','driver','system')),
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broadcasts
CREATE TABLE IF NOT EXISTS broadcasts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    message TEXT,
    audience VARCHAR(50),
    channels TEXT[],
    sent_count INTEGER DEFAULT 0,
    status VARCHAR(50),
    sent_at TIMESTAMP,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter Subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    is_subscribed BOOLEAN DEFAULT true,
    unsubscribe_token VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery Assignments
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    order_number VARCHAR(50),
    driver_id INTEGER REFERENCES users(id),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'assigned',
    delivery_address TEXT,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    last_location_update TIMESTAMP,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Delivery Zones
CREATE TABLE IF NOT EXISTS delivery_zones (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    name VARCHAR(255),
    min_radius_mi DECIMAL(10,2),
    max_radius_mi DECIMAL(10,2),
    delivery_fee DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery Tiers
CREATE TABLE IF NOT EXISTS delivery_tiers (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100),
    min_distance DECIMAL(10,2),
    max_distance DECIMAL(10,2),
    provider_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true
);

-- DoorDash Deliveries
CREATE TABLE IF NOT EXISTS doordash_deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    order_number VARCHAR(50),
    doordash_delivery_id VARCHAR(255) UNIQUE,
    tracking_url TEXT,
    status VARCHAR(50),
    dasher_name VARCHAR(255),
    dasher_phone VARCHAR(20),
    estimated_pickup_time TIMESTAMP,
    estimated_dropoff_time TIMESTAMP,
    fee DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roadie Deliveries
CREATE TABLE IF NOT EXISTS roadie_deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    order_number VARCHAR(50),
    roadie_id VARCHAR(255) UNIQUE,
    tracking_number VARCHAR(255),
    state VARCHAR(50),
    price_cents INTEGER,
    agent_name VARCHAR(255),
    agent_phone VARCHAR(20),
    estimated_pickup_time TIMESTAMP,
    estimated_dropoff_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketplace Orders
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50),
    platform_order_id VARCHAR(255) UNIQUE,
    status VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    items JSONB,
    subtotal DECIMAL(10,2),
    total DECIMAL(10,2),
    delivery_address TEXT,
    raw_payload JSONB,
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Location Partners
CREATE TABLE IF NOT EXISTS location_partners (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    partner_name VARCHAR(50) CHECK (partner_name IN ('uber_eats','doordash','grubhub','instacart','roadie','hhe')),
    is_enabled BOOLEAN DEFAULT false,
    api_key TEXT,
    api_secret TEXT,
    store_id VARCHAR(255),
    tablet_username VARCHAR(255),
    tablet_password VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform Settings
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    commission_rate DECIMAL(5,2),
    is_active BOOLEAN DEFAULT false,
    api_key_set BOOLEAN DEFAULT false,
    credentials JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Settings
CREATE TABLE IF NOT EXISTS payment_settings (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100),
    provider VARCHAR(50),
    is_active BOOLEAN DEFAULT false,
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business Menu Items
CREATE TABLE IF NOT EXISTS business_menu_items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    price1 DECIMAL(10,2),
    price2 DECIMAL(10,2),
    price3 DECIMAL(10,2),
    category VARCHAR(100),
    is_available BOOLEAN DEFAULT true,
    preference INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business Menus (wholesale)
CREATE TABLE IF NOT EXISTS business_menus (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10,2),
    price_tier_2 DECIMAL(10,2),
    price_tier_3 DECIMAL(10,2),
    min_quantity INTEGER DEFAULT 1,
    unit VARCHAR(50),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business Orders
CREATE TABLE IF NOT EXISTS business_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    business_id INTEGER REFERENCES users(id),
    items JSONB,
    sub_total DECIMAL(10,2) DEFAULT 0,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    service_fee DECIMAL(10,2) DEFAULT 0,
    credit_used DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    order_status VARCHAR(50) DEFAULT 'received',
    delivery_address TEXT,
    scheduled_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partner Applications
CREATE TABLE IF NOT EXISTS partner_applications (
    id SERIAL PRIMARY KEY,
    business_name VARCHAR(255),
    ein_number VARCHAR(50),
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    certificate_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    price_tier VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partner Orders
CREATE TABLE IF NOT EXISTS partner_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    partner_user_id INTEGER REFERENCES users(id),
    application_id INTEGER REFERENCES partner_applications(id),
    business_name VARCHAR(255),
    items JSONB,
    sub_total DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    service_fee DECIMAL(10,2) DEFAULT 0,
    credit_applied DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    delivery_address TEXT,
    notes TEXT,
    price_tier VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    cancellation_reason TEXT,
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff Members
CREATE TABLE IF NOT EXISTS staff_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    role VARCHAR(50) CHECK (role IN ('kitchen','delivery','manager','cashier','server')),
    shift_start TIME,
    shift_end TIME,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    current_stock DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(50),
    low_stock_threshold DECIMAL(10,2),
    cost_per_unit DECIMAL(10,2),
    supplier VARCHAR(255),
    notes TEXT,
    last_restocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Restock Log
CREATE TABLE IF NOT EXISTS inventory_restock_log (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2),
    note TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Vacancies
CREATE TABLE IF NOT EXISTS job_vacancies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    department VARCHAR(100),
    location VARCHAR(255),
    type VARCHAR(50),
    description TEXT,
    requirements TEXT,
    salary_range VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Applications
CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    vacancy_id INTEGER REFERENCES job_vacancies(id),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    role_applied VARCHAR(255),
    cover_message TEXT,
    resume_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reservations / Catering
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    party_size INTEGER,
    scheduled_date DATE,
    event_type VARCHAR(100),
    service_type VARCHAR(50),
    notes TEXT,
    admin_notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    estimated_total DECIMAL(10,2),
    quoted_price DECIMAL(10,2),
    invoice_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Urgent Requests
CREATE TABLE IF NOT EXISTS urgent_requests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    reason VARCHAR(255),
    order_id VARCHAR(100),
    message TEXT,
    urgency_level VARCHAR(20),
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER,
    admin_name VARCHAR(255),
    action VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Sidebar
CREATE TABLE IF NOT EXISTS admin_sidebar (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100),
    icon VARCHAR(50),
    route VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- User Favorites
CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, menu_item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_order_number ON chat_messages(order_number);
