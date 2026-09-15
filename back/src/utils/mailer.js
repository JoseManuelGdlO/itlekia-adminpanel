const nodemailer = require('nodemailer');

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

async function sendReminderEmail({ to, note }) {
  const client = getTransporter();
  await client.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Recordatorio: ${note.title}`,
    text: note.content,
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
