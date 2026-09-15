const express = require('express');
const controller = require('../controllers/projectsController');
const members = require('../controllers/membersController');
const finance = require('../controllers/financeController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { financeUpload } = require('../middleware/financeUpload');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('admin'), controller.create);
router.get('/:id/members', members.list);
router.post('/:id/members', requireRole('admin'), members.add);
router.delete('/:id/members/:userId', requireRole('admin'), members.remove);
router.get('/:id/finance', requireRole('admin'), finance.list);
router.post('/:id/finance', requireRole('admin'), financeUpload, finance.create);
router.put('/:id/finance/:itemId', requireRole('admin'), financeUpload, finance.update);
router.delete('/:id/finance/:itemId', requireRole('admin'), finance.remove);
router.get('/:id/finance/:itemId/file', requireRole('admin'), finance.download);
router.put('/:id', requireRole('admin'), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
