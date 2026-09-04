const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { admin } = require("../middleware/authMiddleware");
const {
  checkGiftCard,
  purchaseGiftCard,
  listGiftCards,
  getGiftCardTransactions,
  issueGiftCard,
  voidGiftCard,
} = require("../controllers/giftCardController");

// ── Public ──────────────────────────────────────────────────────────────
router.post("/check", checkGiftCard);
router.post("/purchase", purchaseGiftCard);

// ── Admin only ─────────────────────────────────────────────────────────
router.get("/",                    protect, admin, listGiftCards);
router.post("/issue",              protect, admin, issueGiftCard);
router.get("/:id/transactions",    protect, admin, getGiftCardTransactions);
router.put("/:id/void",            protect, admin, voidGiftCard);

module.exports = router;
