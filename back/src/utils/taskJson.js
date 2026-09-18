function parseEstimatedHours(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: 'Invalid estimated hours' };
  return { value: n };
}

function confirmationFlag(value) {
  return value !== false && value !== 0;
}

function toPublicTask(task, user) {
  const json = typeof task.toJSON === 'function' ? task.toJSON() : { ...task };
  json.assigneeConfirmed = confirmationFlag(json.assigneeConfirmed);
  if (user.role !== 'admin') {
    delete json.estimatedHours;
    return json;
  }
  json.estimatedHours = json.estimatedHours == null ? null : Number(json.estimatedHours);
  return json;
}

module.exports = { parseEstimatedHours, toPublicTask };
