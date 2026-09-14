const express = require('express');
const controller = require('../controllers/projectsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('admin'), controller.create);
router.put('/:id', requireRole('admin'), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
