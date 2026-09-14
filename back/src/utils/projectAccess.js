const { ProjectMember } = require('../models');

async function isProjectMember(userId, projectId) {
  const row = await ProjectMember.findOne({
    where: { userId, projectId },
  });
  return Boolean(row);
}

async function memberProjectIds(userId) {
  const rows = await ProjectMember.findAll({
    where: { userId },
    attributes: ['projectId'],
    order: [['projectId', 'ASC']],
  });
  return rows.map((row) => row.projectId);
}

module.exports = { isProjectMember, memberProjectIds };
