const safeError = require('../utils/safeError');
const pool = require('../config/db');

const getSitemap = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://habibihalalexpress.com';
    
    // Fetch active locations with fallback
    let locations = [];
    try {
      const locResult = await pool.query(
        'SELECT id, updated_at FROM locations WHERE is_active = true ORDER BY id'
      );
      locations = locResult.rows;
    } catch (err) {
      try {
        const locResult = await pool.query(
          'SELECT id FROM locations WHERE is_active = true ORDER BY id'
        );
        locations = locResult.rows.map(r => ({ id: r.id, updated_at: null }));
      } catch (err2) {
        console.error('Error fetching locations for sitemap:', err2);
      }
    }

    // Fetch active menu items with fallback
    let menuItems = [];
    try {
      const menuResult = await pool.query(
        'SELECT id, updated_at FROM menus WHERE is_available = true AND is_active = true ORDER BY id'
      );
      menuItems = menuResult.rows;
    } catch (err) {
      try {
        const menuResult = await pool.query(
          'SELECT id FROM menus WHERE is_available = true AND is_active = true ORDER BY id'
        );
        menuItems = menuResult.rows.map(r => ({ id: r.id, updated_at: null }));
      } catch (err2) {
        console.error('Error fetching menu items for sitemap:', err2);
      }
    }

    // Build XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Helper to format date
    const formatDate = (dateVal) => {
      if (!dateVal) return new Date().toISOString().split('T')[0];
      try {
        return new Date(dateVal).toISOString().split('T')[0];
      } catch (e) {
        return new Date().toISOString().split('T')[0];
      }
    };

    // Static pages
    const staticPages = [
      { path: '', changefreq: 'daily', priority: '1.0' },
      { path: '/menu', changefreq: 'daily', priority: '0.9' },
      { path: '/locations', changefreq: 'weekly', priority: '0.8' },
      { path: '/about', changefreq: 'monthly', priority: '0.7' },
      { path: '/contact', changefreq: 'monthly', priority: '0.7' },
      { path: '/careers', changefreq: 'monthly', priority: '0.6' },
      { path: '/wholesale', changefreq: 'monthly', priority: '0.6' },
      { path: '/videos', changefreq: 'monthly', priority: '0.5' },
    ];

    staticPages.forEach((page) => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.path}</loc>\n`;
      xml += `    <lastmod>${formatDate(null)}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Dynamic locations
    locations.forEach((loc) => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/locations#location-${loc.id}</loc>\n`;
      xml += `    <lastmod>${formatDate(loc.updated_at)}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += '  </url>\n';
    });

    // Dynamic menu items
    menuItems.forEach((item) => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/menu#item-${item.id}</loc>\n`;
      xml += `    <lastmod>${formatDate(item.updated_at)}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (error) {
    console.error('Failed to generate sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};

const getRobotsTxt = (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://habibihalalexpress.com';
  const txt = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Disallow admin and API paths',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /driver',
    'Disallow: /account',
    'Disallow: /checkout',
    'Disallow: /payment',
    'Disallow: /order-confirmation',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    'Disallow: /partner/login',
    'Disallow: /partner',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join('\n');
  res.set('Content-Type', 'text/plain');
  res.send(txt);
};

module.exports = {
  getSitemap,
  getRobotsTxt,
};
