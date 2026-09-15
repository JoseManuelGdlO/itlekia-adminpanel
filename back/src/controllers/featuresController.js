const { Feature, Project } = require('../models');
const { isProjectMember } = require('../utils/projectAccess');

const STATUSES = ['pending', 'done'];

async function loadProject(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

async function loadFeature(req, res, project) {
  const feature = await Feature.findOne({
    where: { id: req.params.featureId, projectId: project.id },
  });
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return null;
  }
  return feature;
}

async function list(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, project.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const features = await Feature.findAll({
    where: { projectId: project.id },
    order: [['id', 'ASC']],
  });
  return res.json(features);
}

async function create(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const { title, description, status, isReminder, remindAt } = req.body;
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Invalid title' });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const feature = await Feature.create({
    projectId: project.id,
    userId: req.user.id,
    title,
    description,
    status: status || 'pending',
    isReminder: Boolean(isReminder),
    remindAt: isReminder ? remindAt : null,
  });
  return res.status(201).json(feature);
}

async function update(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const feature = await loadFeature(req, res, project);
  if (!feature) return;
  const { title, description, status, isReminder, remindAt } = req.body;
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: 'Invalid title' });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (title !== undefined) feature.title = title;
  if (description !== undefined) feature.description = description;
  if (status !== undefined) feature.status = status;
  if (isReminder !== undefined) feature.isReminder = isReminder;
  if (remindAt !== undefined) feature.remindAt = remindAt;
  if (isReminder === false) feature.remindAt = null;
  await feature.save();
  return res.json(feature);
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const feature = await loadFeature(req, res, project);
  if (!feature) return;
  await feature.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
