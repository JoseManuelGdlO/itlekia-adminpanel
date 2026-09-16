const {
  Project,
  Task,
  Note,
  ProjectMember,
  TaskActivity,
  FinanceItem,
  Feature,
  BoardColumn,
  NoteNotify,
  FeatureNotify,
  sequelize,
} = require('../models');
const { memberProjectIds } = require('../utils/projectAccess');
const { seedDefaultColumns } = require('../utils/boardColumns');
const { PROJECT_STATUSES } = require('../utils/projectStatus');
const { removeFinanceFile } = require('../utils/financeFiles');

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
  let financeFileNames = [];
  try {
    const taskIds = (await Task.findAll({ where: { projectId: project.id }, attributes: ['id'], transaction: t })).map((row) => row.id);
    if (taskIds.length) {
      const taskNotes = await Note.findAll({ where: { taskId: taskIds }, attributes: ['id'], transaction: t });
      const taskNoteIds = taskNotes.map((n) => n.id);
      if (taskNoteIds.length) await NoteNotify.destroy({ where: { noteId: taskNoteIds }, transaction: t });
      await Note.destroy({ where: { taskId: taskIds }, transaction: t });
      await TaskActivity.destroy({ where: { taskId: taskIds }, transaction: t });
    }
    const projectNotes = await Note.findAll({ where: { projectId: project.id }, attributes: ['id'], transaction: t });
    const projectNoteIds = projectNotes.map((n) => n.id);
    if (projectNoteIds.length) await NoteNotify.destroy({ where: { noteId: projectNoteIds }, transaction: t });
    await Note.destroy({ where: { projectId: project.id }, transaction: t });
    const features = await Feature.findAll({ where: { projectId: project.id }, attributes: ['id'], transaction: t });
    const featureIds = features.map((f) => f.id);
    if (featureIds.length) await FeatureNotify.destroy({ where: { featureId: featureIds }, transaction: t });
    await Feature.destroy({ where: { projectId: project.id }, transaction: t });
    const financeItems = await FinanceItem.findAll({ where: { projectId: project.id }, attributes: ['storedName'], transaction: t });
    financeFileNames = financeItems.map((item) => item.storedName).filter(Boolean);
    await FinanceItem.destroy({ where: { projectId: project.id }, transaction: t });
    await ProjectMember.destroy({ where: { projectId: project.id }, transaction: t });
    await Task.destroy({ where: { projectId: project.id }, transaction: t });
    await BoardColumn.destroy({ where: { projectId: project.id }, transaction: t });
    await project.destroy({ transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
  financeFileNames.forEach((storedName) => removeFinanceFile(storedName));
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
