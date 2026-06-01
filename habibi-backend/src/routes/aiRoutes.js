const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const protect = require('../middleware/authMiddleware');
const { admin, optionalAuth } = require('../middleware/authMiddleware');

router.post('/chat',            protect, admin, aiController.chatWithAI);
router.get('/stats',            protect, admin, aiController.getKitchenStats);
router.get('/recommendations',  optionalAuth,   aiController.getRecommendations);

module.exports = router;
