const cron = require('node-cron');
const { Op } = require('sequelize');
const { Note, User, Feature } = require('../models');
const { sendReminderEmail } = require('../utils/mailer');

async function checkAndSendReminders() {
  let sent = 0;
  const dueNotes = await Note.findAll({
    where: {
      isReminder: true,
      remindAt: { [Op.lte]: new Date() },
      notifiedAt: null,
    },
    include: { model: User, as: 'owner' },
  });

  for (const note of dueNotes) {
    await sendReminderEmail({ to: note.owner.email, note });
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
    include: { model: User, as: 'creator' },
  });

  for (const feature of dueFeatures) {
    await sendReminderEmail({
      to: feature.creator.email,
      note: { title: feature.title, content: feature.description || '' },
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
