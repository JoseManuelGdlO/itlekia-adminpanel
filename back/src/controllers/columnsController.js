const { sequelize, BoardColumn, Project, Task, Sequelize } = require('../models');
const { isProjectMember } = require('../utils/projectAccess');
const { toPublicColumn, applyColumnNamesToProject } = require('../utils/boardColumns');
const { assertNotPaused } = require('../utils/projectStatus');

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
  if (!assertNotPaused(project, res)) return;
  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Invalid name' });
  const dup = await BoardColumn.findOne({ where: { projectId: project.id, name } });
  if (dup) return res.status(400).json({ error: 'Invalid name' });
  const max = await BoardColumn.max('position', { where: { projectId: project.id } });
  const position = Number.isFinite(max) ? max + 1 : 0;
  try {
    const column = await BoardColumn.create({ projectId: project.id, name, position });
    return res.status(201).json(toPublicColumn(column));
  } catch (err) {
    if (err instanceof Sequelize.UniqueConstraintError) {
      return res.status(400).json({ error: 'Invalid name' });
    }
    throw err;
  }
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
  try {
    await column.save();
    return res.json(toPublicColumn(column));
  } catch (err) {
    if (err instanceof Sequelize.UniqueConstraintError) {
      return res.status(400).json({ error: 'Invalid name' });
    }
    throw err;
  }
}

async function reorder(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  if (!assertNotPaused(project, res)) return;
  const ids = req.body.columnIds;
  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== 'number' || !Number.isInteger(id))
  ) {
    return res.status(400).json({ error: 'Invalid order' });
  }

  const cols = await sequelize.transaction(async (transaction) => {
    const existing = await BoardColumn.findAll({
      where: { projectId: project.id },
      transaction,
    });
    const existingIds = existing.map((column) => column.id).sort((a, b) => a - b);
    const sortedIds = [...ids].sort((a, b) => a - b);
    if (
      ids.length !== existingIds.length ||
      existingIds.some((id, index) => id !== sortedIds[index]) ||
      new Set(ids).size !== ids.length
    ) {
      return null;
    }

    for (let position = 0; position < ids.length; position += 1) {
      const column = existing.find((candidate) => candidate.id === ids[position]);
      column.position = position;
      await column.save({ transaction });
    }

    return BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC'], ['id', 'ASC']],
      transaction,
    });
  });

  if (!cols) return res.status(400).json({ error: 'Invalid order' });
  return res.json(cols.map(toPublicColumn));
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const column = await loadColumn(req, res, project);
  if (!column) return;
  const used = await Task.count({ where: { columnId: column.id } });
  if (used > 0) return res.status(409).json({ error: 'Column not empty' });
  try {
    await column.destroy();
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Sequelize.ForeignKeyConstraintError) {
      return res.status(409).json({ error: 'Column not empty' });
    }
    throw err;
  }
}

async function applyToAll(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const source = await BoardColumn.findAll({
    where: { projectId: project.id },
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  const others = await Project.findAll({
    where: { id: { [Sequelize.Op.ne]: project.id } },
  });
  let updated = 0;
  await sequelize.transaction(async (transaction) => {
    for (const dest of others) {
      await applyColumnNamesToProject(source, dest.id, transaction);
      updated += 1;
    }
  });
  return res.json({ updated });
}

module.exports = { list, create, update, reorder, remove, applyToAll };
