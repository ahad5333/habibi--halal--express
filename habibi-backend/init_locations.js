const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function initLocations() {
  const client = await pool.connect();
  try {
    console.log('Creating locations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        preference_score INTEGER DEFAULT 0,
        opening_hours JSONB DEFAULT '{
          "monday": {"open": "08:00", "close": "22:00"},
          "tuesday": {"open": "08:00", "close": "22:00"},
          "wednesday": {"open": "08:00", "close": "22:00"},
          "thursday": {"open": "08:00", "close": "22:00"},
          "friday": {"open": "08:00", "close": "23:00"},
          "saturday": {"open": "09:00", "close": "23:00"},
          "sunday": {"open": "09:00", "close": "21:00"}
        }',
        holidays JSONB DEFAULT '[]',
        self_delivery_radius DECIMAL(10, 2) DEFAULT 5.00,
        delivery_partner_config JSONB DEFAULT '{
          "uber_eats": true,
          "doordash": true,
          "grubhub": true,
          "self_delivery": true
        }',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Inserting sample locations...');
    await client.query(`
      INSERT INTO locations (name, address, latitude, longitude, phone, self_delivery_radius)
      VALUES 
      ('Manhattan Hub', '123 Street Food Ave, New York, NY 10001', 40.712776, -74.005974, '(212) 555-0101', 5.0),
      ('Brooklyn Base', '456 Atlantic Ave, Brooklyn, NY 11217', 40.6847, -73.9813, '(718) 555-0202', 3.5),
      ('Queens Corner', '789 Queens Blvd, Forest Hills, NY 11375', 40.7181, -73.8448, '(347) 555-0303', 4.0)
      ON CONFLICT DO NOTHING;
    `);

    console.log('Locations system initialized successfully.');
  } catch (err) {
    console.error('Error initializing locations:', err);
  } finally {
    client.release();
    pool.end();
  }
}

initLocations();
