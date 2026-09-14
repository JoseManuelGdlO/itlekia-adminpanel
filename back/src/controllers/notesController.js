const { Note } = require('../models');

async function list(req, res) {
  const where = { userId: req.user.id };
  if (req.query.projectId) where.projectId = req.query.projectId;
  if (req.query.taskId) where.taskId = req.query.taskId;
  const notes = await Note.findAll({ where, order: [['id', 'DESC']] });
  return res.json(notes);
}

async function create(req, res) {
  const { title, content, projectId, taskId, isReminder, remindAt } = req.body;

  if (projectId && taskId) {
    return res.status(400).json({ error: 'A note cannot be linked to both a project and a task' });
  }
  if (isReminder && !remindAt) {
    return res.status(400).json({ error: 'A reminder note requires remindAt' });
  }

  const note = await Note.create({
    userId: req.user.id,
    title,
    content,
    projectId: projectId || null,
    taskId: taskId || null,
    isReminder: !!isReminder,
    remindAt: isReminder ? remindAt : null,
  });
  return res.status(201).json(note);
}

async function update(req, res) {
  const note = await Note.findByPk(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }
  if (note.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, content, isReminder, remindAt } = req.body;
  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;
  if (isReminder !== undefined) note.isReminder = isReminder;
  if (remindAt !== undefined) note.remindAt = remindAt;

  if (note.isReminder && !note.remindAt) {
    return res.status(400).json({ error: 'A reminder note requires remindAt' });
  }

  await note.save();
  return res.json(note);
}

async function remove(req, res) {
  const note = await Note.findByPk(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }
  if (note.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await note.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
