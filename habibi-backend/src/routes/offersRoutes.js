const safeError = require('../utils/safeError');
const express = require("express");
const router  = express.Router();
const { getPublicOffers } = require("../utils/publicOffers");

/* ── GET /api/offers — public, no auth ── */
router.get("/", async (req, res) => {
  try {
    res.json(await getPublicOffers(20));
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

module.exports = router;
