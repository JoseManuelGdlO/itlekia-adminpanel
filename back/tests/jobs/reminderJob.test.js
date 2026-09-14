const { sequelize, User, Note } = require('../../src/models');
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
});
