const express = require("express");
const router = express.Router();
const { getPublicBanners } = require("../controllers/bannersController");

/* ── GET /api/banners — public, no auth: the live Home posters ── */
router.get("/", getPublicBanners);

module.exports = router;
