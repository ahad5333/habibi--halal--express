const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  getPaymentMethods,
  saveFromTransaction,
  setDefaultMethod,
  deletePaymentMethod
} = require("../controllers/paymentMethodController");

router.get("/", protect, getPaymentMethods);
router.post("/save-from-transaction", protect, saveFromTransaction);
router.put("/:id/default", protect, setDefaultMethod);
router.delete("/:id", protect, deletePaymentMethod);

module.exports = router;
