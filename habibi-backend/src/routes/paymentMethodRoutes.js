const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  getPaymentMethods,
  addPaymentMethod,
  setDefaultMethod,
  deletePaymentMethod
} = require("../controllers/paymentMethodController");

router.get("/", protect, getPaymentMethods);
router.post("/", protect, addPaymentMethod);
router.put("/:id/default", protect, setDefaultMethod);
router.delete("/:id", protect, deletePaymentMethod);

module.exports = router;
