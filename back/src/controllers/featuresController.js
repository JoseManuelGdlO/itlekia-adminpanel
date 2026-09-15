const { sequelize, Feature, Project, User, FeatureNotify } = require('../models');
const { isProjectMember } = require('../utils/projectAccess');
const { resolveNotifyUserIds } = require('../utils/notifyRecipients');

const STATUSES = ['pending', 'done'];

function publicNotifyUsers(feature) {
  return (feature.notifyUsers || []).map((u) => ({ id: u.id, name: u.name }));
}

function featureJson(feature) {
  return { ...feature.toJSON(), notifyUsers: publicNotifyUsers(feature) };
}

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
    include: { model: User, as: 'notifyUsers' },
  });
  return res.json(features.map(featureJson));
}

async function create(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const { title, description, status, isReminder, remindAt, notifyUserIds } = req.body;
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Invalid title' });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const t = await sequelize.transaction();
  let feature;
  try {
    feature = await Feature.create(
      {
        projectId: project.id,
        userId: req.user.id,
        title,
        description,
        status: status || 'pending',
        isReminder: Boolean(isReminder),
        remindAt: isReminder ? remindAt : null,
      },
      { transaction: t }
    );

    if (isReminder) {
      const extras = await resolveNotifyUserIds(notifyUserIds, {
        projectId: project.id,
        actorId: req.user.id,
      });
      if (extras.length > 0) {
        await FeatureNotify.bulkCreate(
          extras.map((userId) => ({ featureId: feature.id, userId })),
          { transaction: t }
        );
      }
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    if (err.message === 'Invalid recipient') {
      return res.status(400).json({ error: 'Invalid recipient' });
    }
    throw err;
  }

  const withUsers = await Feature.findByPk(feature.id, {
    include: { model: User, as: 'notifyUsers' },
  });
  return res.status(201).json(featureJson(withUsers));
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
