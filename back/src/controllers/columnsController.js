const { BoardColumn, Project, Task } = require('../models');
const { isProjectMember } = require('../utils/projectAccess');
const { toPublicColumn } = require('../utils/boardColumns');

async function loadProject(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

function normalizeName(value) {
  return String(value ?? '').trim();
}

async function assertAdminOrMember(req, res, project) {
  if (req.user.role === 'admin') return true;
  const allowed = await isProjectMember(req.user.id, project.id);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

async function loadColumn(req, res, project) {
  const column = await BoardColumn.findOne({
    where: { id: req.params.columnId, projectId: project.id },
  });
  if (!column) {
    res.status(404).json({ error: 'Column not found' });
    return null;
  }
  return column;
}

async function list(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  if (!(await assertAdminOrMember(req, res, project))) return;
  const cols = await BoardColumn.findAll({
    where: { projectId: project.id },
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  return res.json(cols.map(toPublicColumn));
}

async function create(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Invalid name' });
  const dup = await BoardColumn.findOne({ where: { projectId: project.id, name } });
  if (dup) return res.status(400).json({ error: 'Invalid name' });
  const max = await BoardColumn.max('position', { where: { projectId: project.id } });
  const position = Number.isFinite(max) ? max + 1 : 0;
  const column = await BoardColumn.create({ projectId: project.id, name, position });
  return res.status(201).json(toPublicColumn(column));
}

async function update(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const column = await loadColumn(req, res, project);
  if (!column) return;
  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Invalid name' });
  const dup = await BoardColumn.findOne({ where: { projectId: project.id, name } });
  if (dup && dup.id !== column.id) return res.status(400).json({ error: 'Invalid name' });
  column.name = name;
  await column.save();
  return res.json(toPublicColumn(column));
}

async function reorder(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const ids = req.body.columnIds;
  const existing = await BoardColumn.findAll({ where: { projectId: project.id } });
  const existingIds = existing.map((c) => c.id).sort((a, b) => a - b);
  const incoming = Array.isArray(ids) ? ids.map(Number) : [];
  const sortedIn = [...incoming].sort((a, b) => a - b);
  if (
    incoming.length !== existingIds.length ||
    existingIds.some((id, i) => id !== sortedIn[i]) ||
    new Set(incoming).size !== incoming.length
  ) {
    return res.status(400).json({ error: 'Invalid order' });
  }
  for (let position = 0; position < incoming.length; position += 1) {
    const col = existing.find((c) => c.id === incoming[position]);
    col.position = position;
    await col.save();
  }
  const cols = await BoardColumn.findAll({
    where: { projectId: project.id },
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  return res.json(cols.map(toPublicColumn));
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const column = await loadColumn(req, res, project);
  if (!column) return;
  const used = await Task.count({ where: { columnId: column.id } });
  if (used > 0) return res.status(409).json({ error: 'Column not empty' });
  await column.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, reorder, remove };
