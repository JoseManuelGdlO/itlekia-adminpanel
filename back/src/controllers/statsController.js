const {
  User,
  Project,
  ProjectMember,
  Task,
  BoardColumn,
} = require('../models');
const { isKanbanListed } = require('../utils/projectStatus');
const { bucketResolver } = require('../utils/taskBuckets');

async function team(req, res) {
  const users = await User.findAll({ order: [['name', 'ASC'], ['id', 'ASC']] });
  const projects = await Project.findAll();
  const listed = projects.filter((p) => isKanbanListed(p.status));
  const listedIds = listed.map((p) => p.id);
  const members = await ProjectMember.findAll({ where: { projectId: listedIds } });
  const columns = listedIds.length
    ? await BoardColumn.findAll({ where: { projectId: listedIds } })
    : [];
  const tasks = listedIds.length
    ? await Task.findAll({ where: { projectId: listedIds } })
    : [];
  const resolveBucket = bucketResolver(columns);

  const projectCountIds = new Map();
  function addProject(userId, projectId) {
    if (!projectCountIds.has(userId)) projectCountIds.set(userId, new Set());
    projectCountIds.get(userId).add(projectId);
  }
  for (const row of members) addProject(row.userId, row.projectId);
  for (const task of tasks) {
    if (task.assigneeId != null) addProject(task.assigneeId, task.projectId);
  }

  const buckets = new Map();
  for (const user of users) {
    buckets.set(user.id, {
      todo: 0,
      inProgress: 0,
      done: 0,
      estimatedHours: 0,
    });
  }
  for (const task of tasks) {
    if (task.assigneeId == null) continue;
    const slot = buckets.get(task.assigneeId);
    if (!slot) continue;
    const bucket = resolveBucket(task.columnId);
    slot[bucket] += 1;
    if (bucket !== 'done') {
      slot.estimatedHours += Number(task.estimatedHours || 0);
    }
  }

  return res.json({
    members: users.map((user) => {
      const slot = buckets.get(user.id);
      return {
        id: user.id,
        name: user.name,
        role: user.role,
        projects: projectCountIds.get(user.id)?.size || 0,
        todo: slot.todo,
        inProgress: slot.inProgress,
        done: slot.done,
        estimatedHours: Math.round(slot.estimatedHours * 100) / 100,
      };
    }),
  });
}

module.exports = { team };
