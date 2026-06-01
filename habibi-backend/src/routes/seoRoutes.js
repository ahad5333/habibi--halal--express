const express = require('express');
const router = express.Router();
const seoController = require('../controllers/seoController');

router.get('/sitemap.xml', seoController.getSitemap);
router.get('/robots.txt', seoController.getRobotsTxt);

module.exports = router;
