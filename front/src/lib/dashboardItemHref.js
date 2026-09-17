export function dashboardItemHref(item) {
  if (item.kind === 'task') return `/tasks/${item.id}`;
  if (item.kind === 'note_reminder') {
    if (item.taskId) return `/tasks/${item.taskId}`;
    if (item.projectId) return `/projects/${item.projectId}`;
    return '/notes';
  }
  if (item.kind === 'feature_reminder') return `/projects/${item.projectId}`;
  if (item.kind === 'project') return `/projects/${item.id}`;
  return '/';
}
