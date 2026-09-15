const cron = require('node-cron');
const { Op } = require('sequelize');
const { Note, User, Feature } = require('../models');
const { sendReminderEmail } = require('../utils/mailer');

async function emailReminder({ people, title, content, uid, start }) {
  const seen = new Set();
  for (const person of people) {
    if (!person?.email || seen.has(person.email)) continue;
    seen.add(person.email);
    try {
      await sendReminderEmail({
        to: person.email,
        note: { title, content },
        uid,
        start,
      });
    } catch (err) {
      console.error(err);
    }
  }
}

async function checkAndSendReminders() {
  let sent = 0;
  const dueNotes = await Note.findAll({
    where: {
      isReminder: true,
      remindAt: { [Op.lte]: new Date() },
      notifiedAt: null,
    },
    include: [
      { model: User, as: 'owner' },
      { model: User, as: 'notifyUsers' },
    ],
  });

  for (const note of dueNotes) {
    await emailReminder({
      people: [note.owner, ...(note.notifyUsers || [])],
      title: note.title,
      content: note.content,
      uid: `note-${note.id}@intelekia`,
      start: note.remindAt,
    });
    note.notifiedAt = new Date();
    await note.save();
    sent += 1;
  }

  const dueFeatures = await Feature.findAll({
    where: {
      isReminder: true,
      remindAt: { [Op.lte]: new Date() },
      notifiedAt: null,
    },
    include: [
      { model: User, as: 'creator' },
      { model: User, as: 'notifyUsers' },
    ],
  });

  for (const feature of dueFeatures) {
    await emailReminder({
      people: [feature.creator, ...(feature.notifyUsers || [])],
      title: feature.title,
      content: feature.description || '',
      uid: `feature-${feature.id}@intelekia`,
      start: feature.remindAt,
    });
    feature.notifiedAt = new Date();
    await feature.save();
    sent += 1;
  }

  return sent;
}

function startReminderJob() {
  cron.schedule('* * * * *', () => {
    checkAndSendReminders().catch((err) => {
      console.error('Reminder job failed:', err);
    });
  });
}

module.exports = { checkAndSendReminders, startReminderJob };
