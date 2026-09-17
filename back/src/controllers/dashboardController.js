const { Task, Project, BoardColumn, Note, Feature, User } = require('../models');
const { memberProjectIds } = require('../utils/projectAccess');
const {
  todayDateString,
  taskBucket,
  reminderBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
} = require('../utils/dashboardWindow');

function isHiddenStatus(status) {
  return status === 'oculto' || status === 'archivado';
}

function isRecipient(userId, ownerId, extras) {
  return ownerId === userId || (extras || []).some((person) => person.id === userId);
}

async function list(req, res) {
  const today = todayDateString(new Date());
  const isAdmin = req.user.role === 'admin';
  const items = [];

  const columns = await BoardColumn.findAll();
  const doneColumnIds = rightmostColumnIds(columns);

  const taskWhere = {};
  if (!isAdmin) taskWhere.assigneeId = req.user.id;

  const tasks = await Task.findAll({
    where: taskWhere,
    include: [{ model: Project, as: 'project' }],
  });

  for (const task of tasks) {
    if (!task.project || isHiddenStatus(task.project.status)) continue;
    if (doneColumnIds.has(task.columnId)) continue;
    const bucket = taskBucket(task.dueDate, today);
    if (!bucket) continue;
    items.push({
      kind: 'task',
      id: task.id,
      title: task.title,
      at: isoAt(task.dueDate),
      bucket,
      projectId: task.projectId,
      projectName: task.project.name,
      taskId: null,
    });
  }

  const notes = await Note.findAll({
    where: { isReminder: true },
    include: [
      { model: User, as: 'notifyUsers' },
      { model: Project, as: 'project' },
      { model: Task, as: 'task', include: [{ model: Project, as: 'project' }] },
    ],
  });

  for (const note of notes) {
    if (!isAdmin && !isRecipient(req.user.id, note.userId, note.notifyUsers)) continue;
    const bucket = reminderBucket(note.remindAt, note.notifiedAt, today);
    if (!bucket) continue;
    const project = note.project || (note.task && note.task.project) || null;
    if (project && isHiddenStatus(project.status)) continue;
    items.push({
      kind: 'note_reminder',
      id: note.id,
      title: note.title,
      at: isoAt(note.remindAt),
      bucket,
      projectId: project ? project.id : null,
      projectName: project ? project.name : null,
      taskId: note.taskId || null,
    });
  }

  const features = await Feature.findAll({
    where: { isReminder: true },
    include: [
      { model: User, as: 'notifyUsers' },
      { model: Project, as: 'project' },
    ],
  });

  for (const feature of features) {
    if (!isAdmin && !isRecipient(req.user.id, feature.userId, feature.notifyUsers)) continue;
    const bucket = reminderBucket(feature.remindAt, feature.notifiedAt, today);
    if (!bucket) continue;
    if (!feature.project || isHiddenStatus(feature.project.status)) continue;
    items.push({
      kind: 'feature_reminder',
      id: feature.id,
      title: feature.title,
      at: isoAt(feature.remindAt),
      bucket,
      projectId: feature.projectId,
      projectName: feature.project.name,
      taskId: null,
    });
  }

  let paused = [];
  if (isAdmin) {
    paused = await Project.findAll({ where: { status: 'parado' } });
  } else {
    const ids = await memberProjectIds(req.user.id);
    paused = ids.length
      ? await Project.findAll({ where: { id: ids, status: 'parado' } })
      : [];
  }

  for (const project of paused) {
    items.push({
      kind: 'project',
      id: project.id,
      title: project.name,
      at: null,
      bucket: 'paused',
      projectId: project.id,
      projectName: project.name,
      taskId: null,
    });
  }

  const ordered = sortDashboardItems(items);
  return res.json({ pulse: countPulse(ordered), items: ordered });
}

module.exports = { list };
