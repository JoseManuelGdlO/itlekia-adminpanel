const { Task, Project, TaskActivity, User, sequelize } = require('../models');
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
  const project = await Project.findByPk(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, project.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (assigneeId) {
      const assigneeOk = await isProjectMember(assigneeId, project.id);
      if (!assigneeOk) {
        return res.status(400).json({ error: 'Assignee must be a project member' });
      }
    }
  }

  const t = await sequelize.transaction();
  try {
    const task = await Task.create(
      { projectId, title, description, assigneeId, dueDate },
      { transaction: t }
    );
    await TaskActivity.create(
      {
        taskId: task.id,
        userId: req.user.id,
        type: 'created',
        fromStatus: null,
        toStatus: task.status,
      },
      { transaction: t }
    );
    await t.commit();
    return res.status(201).json(task);
  } catch (err) {
    await t.rollback();
    throw err;
  }
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
  if (task.status === status) {
    return res.json(task);
  }
  const fromStatus = task.status;
  const t = await sequelize.transaction();
  try {
    task.status = status;
    await task.save({ transaction: t });
    await TaskActivity.create(
      {
        taskId: task.id,
        userId: req.user.id,
        type: 'status_changed',
        fromStatus,
        toStatus: status,
      },
      { transaction: t }
    );
    await t.commit();
    return res.json(task);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listActivities(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, task.projectId);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const rows = await TaskActivity.findAll({
    where: { taskId: task.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
    order: [['id', 'ASC']],
  });
  return res.json(
    rows.map((row) => ({
      id: row.id,
      type: row.type,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      createdAt: row.createdAt,
      user: { id: row.user.id, name: row.user.name },
    }))
  );
}

async function remove(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  await task.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, updateStatus, listActivities, remove };
