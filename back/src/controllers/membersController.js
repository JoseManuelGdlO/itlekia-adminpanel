const { Project, User, ProjectMember } = require('../models');
const { toPublicUser } = require('./authController');
const { isProjectMember } = require('../utils/projectAccess');

async function loadProject(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
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
  const members = await project.getMembers({ order: [['id', 'ASC']] });
  return res.json(members.map(toPublicUser));
}

async function add(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const user = await User.findByPk(req.body.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const [, created] = await ProjectMember.findOrCreate({
    where: { projectId: project.id, userId: user.id },
  });
  if (!created) {
    return res.status(409).json({ error: 'Already a member' });
  }
  return res.status(201).json(toPublicUser(user));
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const row = await ProjectMember.findOne({
    where: { projectId: project.id, userId: req.params.userId },
  });
  if (!row) {
    return res.status(404).json({ error: 'Member not found' });
  }
  await row.destroy();
  return res.status(204).send();
}

module.exports = { list, add, remove };
