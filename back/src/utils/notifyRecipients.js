const { User } = require('../models');
const { isProjectMember } = require('./projectAccess');

async function resolveNotifyUserIds(rawIds, { projectId, actorId }) {
  if (rawIds == null) return [];
  if (!Array.isArray(rawIds)) throw new Error('Invalid recipient');
  if (rawIds.length === 0) return [];
  const actor = Number(actorId);
  const unique = [];
  const seen = new Set();
  for (const raw of rawIds) {
    const id = Number(raw);
    if (id === actor) continue;
    if (!Number.isFinite(id)) throw new Error('Invalid recipient');
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
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
