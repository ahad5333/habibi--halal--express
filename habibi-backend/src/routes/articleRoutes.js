const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/uploadArticleMiddleware');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getPublicArticles,
  getPublicArticleBySlug,
  getAllArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} = require('../controllers/articleController');

// Admin routes FIRST (before /:slug to avoid collision)
router.get   ('/admin/list',   protect, admin, getAllArticles);
router.post  ('/admin',        protect, admin, upload.single('media'), createArticle);
router.patch ('/admin/:id',    protect, admin, upload.single('media'), updateArticle);
router.delete('/admin/:id',    protect, admin, deleteArticle);

// Public
router.get ('/',       getPublicArticles);
router.get ('/:slug',  getPublicArticleBySlug);

module.exports = router;
