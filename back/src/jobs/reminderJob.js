const cron = require('node-cron');
const { Op } = require('sequelize');
const { Note, User } = require('../models');
const { sendReminderEmail } = require('../utils/mailer');

async function checkAndSendReminders() {
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
  }

  return dueNotes.length;
}

function startReminderJob() {
  cron.schedule('* * * * *', () => {
    checkAndSendReminders().catch((err) => {
      console.error('Reminder job failed:', err);
    });
  });
}

module.exports = { checkAndSendReminders, startReminderJob };
