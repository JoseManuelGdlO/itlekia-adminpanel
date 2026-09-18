const { ProjectMember, User } = require('../models');

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

async function isAssignable(userId, projectId) {
  if (userId == null || userId === '') return true;
  if (await isProjectMember(userId, projectId)) return true;
  const user = await User.findByPk(userId);
  return Boolean(user && user.role === 'admin');
}

async function ensureAssigneeMembership(userId, projectId) {
  if (userId == null || userId === '') return;
  const user = await User.findByPk(userId);
  if (!user || user.role !== 'admin') return;
  await ProjectMember.findOrCreate({
    where: { projectId, userId },
  });
}

module.exports = {
  isProjectMember,
  memberProjectIds,
  isAssignable,
  ensureAssigneeMembership,
};
