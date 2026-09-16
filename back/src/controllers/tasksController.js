const { Task, Project, TaskActivity, User, BoardColumn, sequelize } = require('../models');
const { isProjectMember, memberProjectIds } = require('../utils/projectAccess');
const { firstColumn } = require('../utils/boardColumns');
const { sanitizeDescription } = require('../utils/sanitizeDescription');
const { assertNotPaused } = require('../utils/projectStatus');
const mailer = require('../utils/mailer');

function isOwnerOrAdmin(task, user) {
  return user.role === 'admin' || task.assigneeId === user.id;
}

function applyDescription(target, raw) {
  try {
    target.description = sanitizeDescription(raw);
    return null;
  } catch (err) {
    if (err.message === 'Invalid description') {
      return { error: 'Invalid description' };
    }
    throw err;
  }
}

async function assertAssigneeMember(assigneeId, projectId) {
  if (assigneeId == null || assigneeId === '') return null;
  const ok = await isProjectMember(assigneeId, projectId);
  if (!ok) return { error: 'Invalid assignee' };
  return null;
}

async function notifyNewAssignee(task, assigner) {
  if (!task.assigneeId) return;
  try {
    const [assignee, project, actor] = await Promise.all([
      User.findByPk(task.assigneeId),
      Project.findByPk(task.projectId),
      User.findByPk(assigner.id),
    ]);
    if (!assignee || !project || !actor) return;
    await mailer.sendTaskAssignedEmail({
      to: assignee.email,
      task,
      project,
      assigner: { name: actor.name, id: actor.id },
    });
  } catch (err) {
    console.error(err);
  }
}

const pendingAssignmentEmails = new Set();

// Fire-and-forget: SMTP latency or failure must not delay or change the response.
function startAssignmentEmail(task, assigner) {
  const pending = notifyNewAssignee(task, assigner);
  pendingAssignmentEmails.add(pending);
  pending.finally(() => pendingAssignmentEmails.delete(pending));
}

async function __flushAssignmentEmails() {
  while (pendingAssignmentEmails.size > 0) {
    await Promise.all([...pendingAssignmentEmails]);
  }
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
  if (!assertNotPaused(project, res)) return;

  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, project.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const assigneeError = await assertAssigneeMember(assigneeId, project.id);
  if (assigneeError) return res.status(400).json(assigneeError);
  let descriptionHtml;
  try {
    descriptionHtml = sanitizeDescription(description);
  } catch (err) {
    if (err.message === 'Invalid description') {
      return res.status(400).json({ error: 'Invalid description' });
    }
    throw err;
  }

  const t = await sequelize.transaction();
  try {
    const column = req.body.columnId !== undefined
      ? await BoardColumn.findByPk(req.body.columnId)
      : await firstColumn(project.id);
    if (!column || column.projectId !== project.id) {
      await t.rollback();
      return res.status(400).json({ error: 'Invalid column' });
    }
    const task = await Task.create(
      {
        projectId,
        title,
        description: descriptionHtml,
        assigneeId: assigneeId === '' ? null : assigneeId,
        dueDate,
        columnId: column.id,
      },
      { transaction: t }
    );
    await TaskActivity.create(
      {
        taskId: task.id,
        userId: req.user.id,
        type: 'created',
        fromStatus: null,
        toStatus: column.name,
      },
      { transaction: t }
    );
    await t.commit();
    startAssignmentEmail(task, req.user);
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
  const previousAssigneeId = task.assigneeId;

  if (!isOwnerOrAdmin(task, req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const adminProjectUpdate = req.user.role === 'admin' && req.body.projectId !== undefined;
  const nextProjectIdForAssignee = adminProjectUpdate
    ? Number(req.body.projectId)
    : task.projectId;
  const projectChanged =
    adminProjectUpdate && nextProjectIdForAssignee !== Number(task.projectId);
  if (req.body.assigneeId !== undefined || (projectChanged && task.assigneeId != null)) {
    const nextAssigneeId =
      req.body.assigneeId !== undefined ? req.body.assigneeId : task.assigneeId;
    const assigneeError = await assertAssigneeMember(nextAssigneeId, nextProjectIdForAssignee);
    if (assigneeError) return res.status(400).json(assigneeError);
  }
  if (req.body.description !== undefined) {
    const descriptionError = applyDescription(task, req.body.description);
    if (descriptionError) return res.status(400).json(descriptionError);
  }

  if (req.user.role === 'admin') {
    const { title, assigneeId, dueDate, projectId } = req.body;
    const nextProjectId = projectId === undefined ? task.projectId : Number(projectId);
    const currentColumn = await BoardColumn.findByPk(task.columnId);
    if (
      (projectId !== undefined && nextProjectId !== Number(task.projectId))
      || !currentColumn
      || currentColumn.projectId !== nextProjectId
    ) {
      const column = await firstColumn(nextProjectId);
      if (!column) return res.status(400).json({ error: 'Invalid column' });
      task.columnId = column.id;
    }
    if (title !== undefined) task.title = title;
    if (assigneeId !== undefined) task.assigneeId = assigneeId === '' ? null : assigneeId;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (projectId !== undefined) task.projectId = nextProjectId;
  }

  await task.save();
  if (Number(task.assigneeId) !== Number(previousAssigneeId)) {
    const [fromUser, toUser] = await Promise.all([
      previousAssigneeId ? User.findByPk(previousAssigneeId) : null,
      task.assigneeId ? User.findByPk(task.assigneeId) : null,
    ]);
    await TaskActivity.create({
      taskId: task.id,
      userId: req.user.id,
      type: 'assignee_changed',
      fromStatus: fromUser?.name || 'Sin asignar',
      toStatus: toUser?.name || 'Sin asignar',
    });
  }
  if (
    task.assigneeId != null
    && Number(task.assigneeId) !== Number(previousAssigneeId)
  ) {
    startAssignmentEmail(task, req.user);
  }
  return res.json(task);
}

async function updateColumn(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const project = await Project.findByPk(task.projectId);
  if (!assertNotPaused(project, res)) return;
  if (!isOwnerOrAdmin(task, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const column = await BoardColumn.findByPk(req.body.columnId);
  if (!column || column.projectId !== task.projectId) {
    return res.status(400).json({ error: 'Invalid column' });
  }
  if (task.columnId === column.id) return res.json(task);
  const from = await BoardColumn.findByPk(task.columnId);
  const t = await sequelize.transaction();
  try {
    task.columnId = column.id;
    await task.save({ transaction: t });
    await TaskActivity.create(
      {
        taskId: task.id,
        userId: req.user.id,
        type: 'status_changed',
        fromStatus: from ? from.name : null,
        toStatus: column.name,
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
      user: row.user
        ? { id: row.user.id, name: row.user.name }
        : { id: row.userId, name: 'Usuario' },
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

module.exports = {
  list,
  create,
  update,
  updateColumn,
  listActivities,
  remove,
  __flushAssignmentEmails,
};
