const { sequelize, Note, User, NoteNotify, Task } = require('../models');
const { resolveNotifyUserIds } = require('../utils/notifyRecipients');

function publicNotifyUsers(note) {
  return (note.notifyUsers || []).map((u) => ({ id: u.id, name: u.name }));
}

function noteJson(note) {
  return { ...note.toJSON(), notifyUsers: publicNotifyUsers(note) };
}

async function list(req, res) {
  const where = { userId: req.user.id };
  if (req.query.projectId) where.projectId = req.query.projectId;
  if (req.query.taskId) where.taskId = req.query.taskId;
  const notes = await Note.findAll({
    where,
    order: [['id', 'DESC']],
    include: { model: User, as: 'notifyUsers' },
  });
  return res.json(notes.map(noteJson));
}

async function create(req, res) {
  const { title, content, projectId, taskId, isReminder, remindAt, notifyUserIds } = req.body;

  if (projectId && taskId) {
    return res.status(400).json({ error: 'A note cannot be linked to both a project and a task' });
  }
  if (isReminder && !remindAt) {
    return res.status(400).json({ error: 'A reminder note requires remindAt' });
  }

  const t = await sequelize.transaction();
  let note;
  try {
    note = await Note.create(
      {
        userId: req.user.id,
        title,
        content,
        projectId: projectId || null,
        taskId: taskId || null,
        isReminder: !!isReminder,
        remindAt: isReminder ? remindAt : null,
      },
      { transaction: t }
    );

    if (isReminder) {
      let memberProjectId = projectId || null;
      if (!memberProjectId && taskId) {
        const task = await Task.findByPk(taskId, { transaction: t });
        if (task) memberProjectId = task.projectId;
      }
      const extras = await resolveNotifyUserIds(notifyUserIds, {
        projectId: memberProjectId,
        actorId: req.user.id,
      });
      if (extras.length > 0) {
        await NoteNotify.bulkCreate(
          extras.map((userId) => ({ noteId: note.id, userId })),
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

  const withUsers = await Note.findByPk(note.id, {
    include: { model: User, as: 'notifyUsers' },
  });
  return res.status(201).json(noteJson(withUsers));
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
