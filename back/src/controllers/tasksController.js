const { Task } = require('../models');
const { isProjectMember, memberProjectIds } = require('../utils/projectAccess');

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];

function isOwnerOrAdmin(task, user) {
  return user.role === 'admin' || task.assigneeId === user.id;
}

async function list(req, res) {
  const where = {};
  if (req.user.role === 'admin') {
    if (req.query.projectId) where.projectId = req.query.projectId;
    if (req.query.assigneeId) where.assigneeId = req.query.assigneeId;
  } else if (req.query.projectId) {
    const allowed = await isProjectMember(req.user.id, req.query.projectId);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    where.projectId = req.query.projectId;
  } else {
    const ids = await memberProjectIds(req.user.id);
    if (ids.length === 0) {
      return res.json([]);
    }
    where.projectId = ids;
  }
  const tasks = await Task.findAll({ where, order: [['id', 'ASC']] });
  return res.json(tasks);
}

async function create(req, res) {
  const { projectId, title, description, assigneeId, dueDate } = req.body;
  const task = await Task.create({ projectId, title, description, assigneeId, dueDate });
  return res.status(201).json(task);
}

async function update(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!isOwnerOrAdmin(task, req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.user.role === 'admin') {
    const { title, description, assigneeId, dueDate, projectId } = req.body;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (assigneeId !== undefined) task.assigneeId = assigneeId;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (projectId !== undefined) task.projectId = projectId;
  } else {
    if (req.body.description !== undefined) task.description = req.body.description;
  }

  await task.save();
  return res.json(task);
}

async function updateStatus(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!isOwnerOrAdmin(task, req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  task.status = status;
  await task.save();
  return res.json(task);
}

async function remove(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  await task.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, updateStatus, remove };
