const express = require("express");
const router = express.Router();
const { getPublicByoIngredients } = require("../controllers/byoIngredientController");

router.get("/", getPublicByoIngredients);

module.exports = router;
