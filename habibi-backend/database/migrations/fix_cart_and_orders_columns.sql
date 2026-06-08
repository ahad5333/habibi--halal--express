-- Add user_id to carts (controller uses user_id, schema has customer_id)
ALTER TABLE carts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
UPDATE carts SET user_id = customer_id WHERE user_id IS NULL AND customer_id IS NOT NULL;

-- Add menu_id to cart_items (controller uses menu_id, schema has menu_item_id)
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS menu_id INTEGER;
UPDATE cart_items SET menu_id = menu_item_id WHERE menu_id IS NULL AND menu_item_id IS NOT NULL;

-- Add user_id to guest_orders if it was created before this column was added
ALTER TABLE guest_orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Create menus view so cart JOIN queries work (menu_items table has title not name)
CREATE OR REPLACE VIEW menus AS
  SELECT id, title AS name, description, image_url, price,
         category, is_active, is_spicy, created_at
  FROM menu_items;
