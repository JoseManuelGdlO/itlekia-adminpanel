const PROJECT_STATUSES = ['trabajando', 'parado', 'oculto', 'archivado'];

function isKanbanListed(status) {
  return status === 'trabajando' || status === 'parado';
}

function assertNotPaused(project, res) {
  if (project.status === 'parado') {
    res.status(403).json({ error: 'Project is paused' });
    return false;
  }
  return true;
}

module.exports = { PROJECT_STATUSES, isKanbanListed, assertNotPaused };
