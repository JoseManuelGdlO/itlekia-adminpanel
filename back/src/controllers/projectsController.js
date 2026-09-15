const { Project, sequelize } = require('../models');
const { memberProjectIds } = require('../utils/projectAccess');
const { seedDefaultColumns } = require('../utils/boardColumns');

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
    where: { id: projectIds },
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
  if (status !== undefined) project.status = status;
  await project.save();
  return res.json(project);
}

async function remove(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  await project.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
