const pool = require('../src/config/db');

const BRONX_LOCATIONS = [
  {
    title: 'Bedford Park & Jerome Ave',
    brief_address: '204 E Mosholu Pkwy S, Bronx',
    exact_address: '204 E Mosholu Pkwy S, Bronx, NY 10458',
    phone_number: '(718) 367-7878',
    working_days_hours: 'Open 24 Hours · 365 Days a Year',
    latitude: 40.873426,
    longitude: -73.890060,
    delivery_radius_miles: 5,
    preference_level: 5
  },
  {
    title: 'Lehman College Area',
    brief_address: '250 Bedford Park Blvd W, Bronx',
    exact_address: '250 Bedford Park Blvd W, Bronx, NY 10468',
    phone_number: '(718) 367-7879',
    working_days_hours: 'Mon – Sun: 7AM – 11PM',
    latitude: 40.8718,
    longitude: -73.8999,
    delivery_radius_miles: 4,
    preference_level: 4
  },
  {
    title: 'Bronx High School of Science',
    brief_address: '75 W 205th St, Bronx',
    exact_address: '75 W 205th St, Bronx, NY 10468',
    phone_number: '(718) 367-7880',
    working_days_hours: 'Mon – Fri: 6AM – 10PM',
    latitude: 40.8782,
    longitude: -73.8912,
    delivery_radius_miles: 4,
    preference_level: 3
  },
  {
    title: 'Kingsbridge Road & Jerome Ave',
    brief_address: '3521 Jerome Ave, Bronx',
    exact_address: '3521 Jerome Ave, Bronx, NY 10467',
    phone_number: '(718) 367-7881',
    working_days_hours: 'Mon – Sun: 7AM – 12AM',
    latitude: 40.8839,
    longitude: -73.8824,
    delivery_radius_miles: 4,
    preference_level: 2
  }
];

async function seed() {
  console.log('Clearing existing locations...');
  await pool.query('DELETE FROM locations');

  console.log('Seeding real Bronx locations...');
  for (const loc of BRONX_LOCATIONS) {
    await pool.query(
      `INSERT INTO locations (
        title, brief_address, exact_address, phone_number, 
        working_days_hours, latitude, longitude, 
        delivery_radius_miles, preference_level, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [
        loc.title, loc.brief_address, loc.exact_address, loc.phone_number,
        loc.working_days_hours, loc.latitude, loc.longitude,
        loc.delivery_radius_miles, loc.preference_level
      ]
    );
    console.log(`Added: ${loc.title}`);
  }

  console.log('Seeding complete.');
  pool.end();
}

seed().catch(e => { console.error(e); pool.end(); });
