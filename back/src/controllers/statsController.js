const {
  User,
  Project,
  ProjectMember,
  Task,
  BoardColumn,
} = require('../models');
const { isKanbanListed } = require('../utils/projectStatus');
const { columnBucket } = require('../utils/taskBuckets');

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

  const projectCount = new Map();
  for (const row of members) {
    projectCount.set(row.userId, (projectCount.get(row.userId) || 0) + 1);
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
    const bucket = columnBucket(task.columnId, columns);
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
        projects: projectCount.get(user.id) || 0,
        todo: slot.todo,
        inProgress: slot.inProgress,
        done: slot.done,
        estimatedHours: slot.estimatedHours,
      };
    }),
  });
}

module.exports = { team };
