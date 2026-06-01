const express = require("express");
const router = express.Router();
const { submitPartnerApplication, upload } = require("../controllers/partnerController");

router.post("/apply", upload.single("certificate"), submitPartnerApplication);

module.exports = router;

