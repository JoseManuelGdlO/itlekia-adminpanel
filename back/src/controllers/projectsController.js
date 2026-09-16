const { Project, Task, BoardColumn, sequelize } = require('../models');
const { memberProjectIds } = require('../utils/projectAccess');
const { seedDefaultColumns } = require('../utils/boardColumns');
const { PROJECT_STATUSES } = require('../utils/projectStatus');

async function list(req, res) {
  if (req.user.role === 'admin') {
    const projects = await Project.findAll({ order: [['id', 'ASC']] });
    return res.json(projects);
  }

  const projectIds = await memberProjectIds(req.user.id);
  if (projectIds.length === 0) {
    return res.json([]);
  }
  const projects = await Project.findAll({
    where: { id: projectIds, status: ['trabajando', 'parado'] },
    order: [['id', 'ASC']],
  });
  return res.json(projects);
}

async function create(req, res) {
  const { name, description } = req.body;
  const t = await sequelize.transaction();
  try {
    const project = await Project.create({ name, description }, { transaction: t });
    await seedDefaultColumns(project.id, t);
    await t.commit();
    return res.status(201).json(project);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function update(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  const { name, description, status } = req.body;
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (status !== undefined) {
    if (!PROJECT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    project.status = status;
  }
  await project.save();
  return res.json(project);
}

async function remove(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  const t = await sequelize.transaction();
  try {
    await Task.destroy({ where: { projectId: project.id }, transaction: t });
    await BoardColumn.destroy({ where: { projectId: project.id }, transaction: t });
    await project.destroy({ transaction: t });
    await t.commit();
    return res.status(204).send();
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

module.exports = { list, create, update, remove };
