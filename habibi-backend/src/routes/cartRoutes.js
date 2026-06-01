const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  getCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  syncCart,
} = require("../controllers/cartController");

router.use(protect);

router.get("/", getCart);
router.post("/add", addToCart);
router.post("/sync", syncCart);
router.delete("/remove/:id", removeFromCart);
router.put("/update/:id", updateQuantity);
router.delete("/clear", clearCart);

module.exports = router;