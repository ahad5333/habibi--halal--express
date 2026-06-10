-- Fix reservations table if production DB was created with old schema
-- (reservation_date/time/guests/occasion/special_requests instead of name/email/scheduled_date/party_size/notes)

-- Drop NOT NULL from old columns so new inserts (which use scheduled_date/party_size) don't violate them
ALTER TABLE reservations ALTER COLUMN reservation_date DROP NOT NULL;
ALTER TABLE reservations ALTER COLUMN reservation_time DROP NOT NULL;
ALTER TABLE reservations ALTER COLUMN guests         DROP NOT NULL;

-- Add columns that schema.sql defines but old DBs may be missing
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS name           VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS email          VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS phone          VARCHAR(20);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS party_size     INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS admin_notes    TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS quoted_price   DECIMAL(10,2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS invoice_sent   BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(10,2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event_type     VARCHAR(100);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS service_type   VARCHAR(50);

-- Backfill from old column names if they exist (safe: IF EXISTS avoids errors)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='reservation_date') THEN
    UPDATE reservations SET scheduled_date = reservation_date::DATE WHERE scheduled_date IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='guests') THEN
    UPDATE reservations SET party_size = guests WHERE party_size IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='occasion') THEN
    UPDATE reservations SET name = occasion WHERE name IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='special_requests') THEN
    UPDATE reservations SET notes = special_requests WHERE notes IS NULL;
  END IF;
END $$;
