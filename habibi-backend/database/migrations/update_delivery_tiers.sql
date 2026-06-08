-- Update delivery_tiers to match spec: In-House → DoorDash Drive → Roadie → Pickup Only
-- Safe to run multiple times (DELETE + INSERT approach)

DELETE FROM delivery_tiers;

INSERT INTO delivery_tiers (label, min_distance, max_distance, provider_type, is_active) VALUES
  ('In-House Delivery',    0,    5,    'in_house',    TRUE),
  ('DoorDash Drive',       5,    30,   'doordash',    TRUE),
  ('Roadie Express',       30,   150,  'roadie',      TRUE),
  ('Roadie Long Distance', 150,  350,  'roadie',      TRUE),
  ('Pickup Only',          350,  9999, 'pickup_only', TRUE);

-- Add label column if missing on older DB schemas
ALTER TABLE delivery_tiers ADD COLUMN IF NOT EXISTS label VARCHAR(100);
