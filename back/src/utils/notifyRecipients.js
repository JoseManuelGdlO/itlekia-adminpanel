const { User } = require('../models');
const { isProjectMember } = require('./projectAccess');

async function resolveNotifyUserIds(rawIds, { projectId, actorId }) {
  if (rawIds == null || rawIds.length === 0) return [];
  const unique = [...new Set(rawIds.map(Number).filter((id) => Number.isFinite(id) && id !== Number(actorId)))];
  const extras = [];
  for (const userId of unique) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Invalid recipient');
    if (projectId != null && projectId !== '') {
      const ok = await isProjectMember(userId, Number(projectId));
      if (!ok) throw new Error('Invalid recipient');
    }
    extras.push(userId);
  }
  return extras;
}

module.exports = { resolveNotifyUserIds };
