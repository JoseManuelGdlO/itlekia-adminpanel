const { rightmostColumnIds } = require('./dashboardWindow');

function leftmostColumnIds(columns) {
  const best = new Map();
  for (const col of columns) {
    const prev = best.get(col.projectId);
    if (
      !prev
      || col.position < prev.position
      || (col.position === prev.position && col.id < prev.id)
    ) {
      best.set(col.projectId, col);
    }
  }
  return new Set([...best.values()].map((col) => col.id));
}

function columnBucket(columnId, columns) {
  const id = Number(columnId);
  const right = rightmostColumnIds(columns);
  if (right.has(id)) return 'done';
  const left = leftmostColumnIds(columns);
  if (left.has(id)) return 'todo';
  return 'inProgress';
}

module.exports = { leftmostColumnIds, columnBucket };
