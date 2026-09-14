const { Op } = require('sequelize');
const { Task, ProjectMember } = require('../models');

// Boot helper: copy existing task assignees into ProjectMember.
// Task create/update must not call this. New assignees are not auto-members.
async function backfillProjectMembers() {
  if ((await ProjectMember.count()) > 0) {
    return;
  }

  const tasks = await Task.findAll({
    attributes: ['projectId', 'assigneeId'],
    where: { assigneeId: { [Op.ne]: null } },
  });
  const seen = new Set();
  for (const task of tasks) {
    const key = `${task.projectId}:${task.assigneeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await ProjectMember.findOrCreate({
      where: { projectId: task.projectId, userId: task.assigneeId },
    });
  }
}

module.exports = { backfillProjectMembers };
