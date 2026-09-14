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

module.exports = { sendReminderEmail, __setTransporterForTests };
