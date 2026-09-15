const express = require('express');
const controller = require('../controllers/tasksController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/column', controller.updateColumn);
router.get('/:id/activities', controller.listActivities);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
