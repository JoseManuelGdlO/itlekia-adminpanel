const express = require('express');
const controller = require('../controllers/projectsController');
const members = require('../controllers/membersController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('admin'), controller.create);
router.get('/:id/members', members.list);
router.post('/:id/members', requireRole('admin'), members.add);
router.delete('/:id/members/:userId', requireRole('admin'), members.remove);
router.put('/:id', requireRole('admin'), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
