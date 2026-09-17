const DASHBOARD_TZ = 'America/Mexico_City';

function calendarDateInTz(date, timeZone = DASHBOARD_TZ) {
  if (date == null || date === '') return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function todayDateString(now) {
  return calendarDateInTz(now || new Date());
}

function taskBucket(dueDate, todayStr) {
  const day = calendarDateInTz(dueDate);
  if (!day) return null;
  if (day < todayStr) return 'overdue';
  if (day === todayStr) return 'today';
  return null;
}

function reminderBucket(remindAt, notifiedAt, todayStr) {
  const day = calendarDateInTz(remindAt);
  if (!day) return null;
  if (day === todayStr) return 'today';
  if (day < todayStr && notifiedAt == null) return 'overdue';
  return null;
}

function rightmostColumnIds(columns) {
  const best = new Map();
  for (const col of columns) {
    const prev = best.get(col.projectId);
    if (
      !prev
      || col.position > prev.position
      || (col.position === prev.position && col.id > prev.id)
    ) {
      best.set(col.projectId, col);
    }
  }
  return new Set([...best.values()].map((col) => col.id));
}

function isoAt(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function itemGroup(item) {
  if (item.kind === 'task' && item.bucket === 'overdue') return 0;
  if (item.kind === 'task' && item.bucket === 'today') return 1;
  if (item.kind === 'note_reminder' || item.kind === 'feature_reminder') return 2;
  return 3;
}

function kindOrder(kind) {
  if (kind === 'note_reminder') return 0;
  if (kind === 'feature_reminder') return 1;
  return 2;
}

function sortDashboardItems(items) {
  return [...items].sort((a, b) => {
    const group = itemGroup(a) - itemGroup(b);
    if (group) return group;
    const atA = a.at || '';
    const atB = b.at || '';
    if (atA !== atB) return atA < atB ? -1 : 1;
    if (itemGroup(a) === 2) {
      const kind = kindOrder(a.kind) - kindOrder(b.kind);
      if (kind) return kind;
    }
    if (itemGroup(a) === 3) {
      const name = String(a.projectName || '').localeCompare(String(b.projectName || ''), 'es');
      if (name) return name;
    }
    return a.id - b.id;
  });
}

function countPulse(items) {
  return {
    overdue: items.filter((item) => item.kind === 'task' && item.bucket === 'overdue').length,
    today: items.filter((item) => item.kind === 'task' && item.bucket === 'today').length,
    remindersToday: items.filter(
      (item) => item.kind === 'note_reminder' || item.kind === 'feature_reminder'
    ).length,
    paused: items.filter((item) => item.kind === 'project').length,
  };
}

module.exports = {
  DASHBOARD_TZ,
  calendarDateInTz,
  todayDateString,
  taskBucket,
  reminderBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
};
