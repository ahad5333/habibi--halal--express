const express = require('express');
const router  = express.Router();
const protect = require('../middleware/authMiddleware');
const { getSavedCustoms, createSavedCustom, deleteSavedCustom } = require('../controllers/savedCustomController');

router.get('/',    protect, getSavedCustoms);
router.post('/',   protect, createSavedCustom);
router.delete('/:id', protect, deleteSavedCustom);

module.exports = router;
