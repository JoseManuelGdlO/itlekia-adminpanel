const express = require('express');
const controller = require('../controllers/statsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/team', controller.team);
module.exports = router;
