const { sendReminderEmail, sendTaskAssignedEmail, __setTransporterForTests } = require('../../src/utils/mailer');

describe('mailer', () => {
  it('sends a reminder email with the note title in the subject', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    __setTransporterForTests({ sendMail });

    await sendReminderEmail({
      to: 'dev@example.com',
      note: { title: 'Ping client', content: 'Send status update' },
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@example.com',
        subject: expect.stringContaining('Ping client'),
      })
    );
  });

  it('attaches reminder.ics with uid when uid and start are provided', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    __setTransporterForTests({ sendMail });

    await sendReminderEmail({
      to: 'dev@example.com',
      note: { title: 'Ping client', content: 'Send status update' },
      uid: 'note-9@intelekia',
      start: new Date('2026-09-15T20:05:00.000Z'),
    });

    const mailOptions = sendMail.mock.calls[0][0];
    expect(mailOptions.attachments).toBeDefined();
    expect(mailOptions.attachments[0].filename).toBe('reminder.ics');
    expect(mailOptions.attachments[0].content).toContain('UID:note-9@intelekia');
    expect(mailOptions.attachments[0].content).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });
});

describe('sendTaskAssignedEmail', () => {
  const originalHost = process.env.SMTP_HOST;
  const originalFront = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.SMTP_HOST = originalHost;
    process.env.FRONTEND_URL = originalFront;
  });

  it('sends subject and link when SMTP and FRONTEND_URL are set', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.FRONTEND_URL = 'https://app.example.com';
    const sendMail = jest.fn().mockResolvedValue({});
    __setTransporterForTests({ sendMail });

    await sendTaskAssignedEmail({
      to: 'dev@example.com',
      task: { id: 9, title: 'Fix nav' },
      project: { name: 'Website Revamp' },
      assigner: { name: 'Ada' },
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@example.com',
        subject: 'Nueva tarea: Fix nav',
        text: expect.stringContaining('https://app.example.com/tasks/9'),
      })
    );
    expect(sendMail.mock.calls[0][0].text).toContain('Website Revamp');
    expect(sendMail.mock.calls[0][0].text).toContain('Ada');
  });

  it('skips sendMail when SMTP_HOST is unset', async () => {
    delete process.env.SMTP_HOST;
    const sendMail = jest.fn();
    __setTransporterForTests({ sendMail });
    await sendTaskAssignedEmail({
      to: 'dev@example.com',
      task: { id: 1, title: 'T' },
      project: { name: 'P' },
      assigner: { name: 'A' },
    });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
