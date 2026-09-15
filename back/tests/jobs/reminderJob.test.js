const { sequelize, User, Note, Feature, Project, NoteNotify } = require('../../src/models');
const mailer = require('../../src/utils/mailer');
const { checkAndSendReminders } = require('../../src/jobs/reminderJob');

describe('checkAndSendReminders', () => {
  let user;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    user = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('sends an email for a due reminder and marks it notified', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });

    const due = await Note.create({
      userId: user.id,
      title: 'Ping client',
      content: 'Send status update',
      isReminder: true,
      remindAt: new Date(Date.now() - 1000),
    });

    const sentCount = await checkAndSendReminders();

    expect(sentCount).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    await due.reload();
    expect(due.notifiedAt).not.toBeNull();
  });

  it('does not resend an already-notified reminder', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });

    await checkAndSendReminders();

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('ignores reminders not yet due', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });

    await Note.create({
      userId: user.id,
      title: 'Future reminder',
      content: 'Not yet',
      isReminder: true,
      remindAt: new Date(Date.now() + 60000),
    });

    const sentCount = await checkAndSendReminders();

    expect(sentCount).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends an email for a due feature reminder and does not resend', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });
    const project = await Project.create({ name: 'Website Revamp' });
    const feature = await Feature.create({
      projectId: project.id,
      userId: user.id,
      title: 'Ship SSO',
      description: 'Check IdP',
      isReminder: true,
      remindAt: new Date(Date.now() - 1000),
    });

    const first = await checkAndSendReminders();

    expect(first).toBeGreaterThanOrEqual(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: 'Recordatorio: Ship SSO',
        text: 'Check IdP',
      })
    );
    await feature.reload();
    expect(feature.notifiedAt).not.toBeNull();

    sendMail.mockClear();
    const second = await checkAndSendReminders();
    expect(sendMail).not.toHaveBeenCalled();
    expect(second).toBe(0);
  });

  it('emails owner and extra notify users and does not resend', async () => {
    const extra = await User.create({
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });

    const due = await Note.create({
      userId: user.id,
      title: 'Standup',
      content: 'Join call',
      isReminder: true,
      remindAt: new Date(Date.now() - 1000),
    });
    await NoteNotify.create({ noteId: due.id, userId: extra.id });

    const sentCount = await checkAndSendReminders();

    expect(sentCount).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
    const recipients = sendMail.mock.calls.map((call) => call[0].to);
    expect(recipients).toEqual(expect.arrayContaining([user.email, extra.email]));
    for (const [mailOptions] of sendMail.mock.calls) {
      expect(mailOptions.attachments).toBeDefined();
      expect(mailOptions.attachments[0].filename).toBe('reminder.ics');
      expect(mailOptions.attachments[0].content).toContain(`UID:note-${due.id}@intelekia`);
    }
    await due.reload();
    expect(due.notifiedAt).not.toBeNull();

    sendMail.mockClear();
    await checkAndSendReminders();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sets notifiedAt when the first recipient send fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const extra = await User.create({
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const sendMail = jest
      .fn()
      .mockRejectedValueOnce(new Error('SMTP down'))
      .mockResolvedValueOnce({});
    mailer.__setTransporterForTests({ sendMail });

    const due = await Note.create({
      userId: user.id,
      title: 'Partial fail',
      content: 'Still mark notified',
      isReminder: true,
      remindAt: new Date(Date.now() - 1000),
    });
    await NoteNotify.create({ noteId: due.id, userId: extra.id });

    try {
      await checkAndSendReminders();

      expect(sendMail).toHaveBeenCalledTimes(2);
      expect(sendMail.mock.calls[1][0].to).toBe(extra.email);
      await due.reload();
      expect(due.notifiedAt).not.toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
