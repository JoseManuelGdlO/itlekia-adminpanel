const nodemailer = require('nodemailer');
const { buildReminderIcs } = require('./reminderIcs');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function __setTransporterForTests(fakeTransporter) {
  transporter = fakeTransporter;
}

async function sendReminderEmail({ to, note, uid, start }) {
  const ics = buildReminderIcs({
    uid: uid ?? 'note-unknown@intelekia',
    title: note.title,
    description: note.content,
    start: start ?? new Date(),
  });
  const client = getTransporter();
  await client.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Recordatorio: ${note.title}`,
    text: note.content,
    attachments: [{ filename: 'reminder.ics', content: ics, contentType: 'text/calendar' }],
  });
}

async function sendTaskAssignedEmail({ to, task, project, assigner }) {
  if (!process.env.SMTP_HOST) {
    console.error('SMTP_HOST unset; skip assignment email');
    return;
  }
  const lines = [
    `Proyecto: ${project.name}`,
    `Asignado por: ${assigner.name}`,
    `Tarea: ${task.title}`,
  ];
  const base = process.env.FRONTEND_URL;
  if (base) {
    lines.push(`Enlace: ${base.replace(/\/$/, '')}/tasks/${task.id}`);
  }
  const client = getTransporter();
  await client.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Nueva tarea: ${task.title}`,
    text: lines.join('\n'),
  });
}

module.exports = { sendReminderEmail, sendTaskAssignedEmail, __setTransporterForTests };
