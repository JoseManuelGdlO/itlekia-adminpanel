const { Task, Project, BoardColumn } = require('../models');
const {
  todayDateString,
  taskBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
} = require('../utils/dashboardWindow');

function isHiddenStatus(status) {
  return status === 'oculto' || status === 'archivado';
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

  const ordered = sortDashboardItems(items);
  return res.json({ pulse: countPulse(ordered), items: ordered });
}

module.exports = { list };
