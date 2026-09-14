const { sendReminderEmail, __setTransporterForTests } = require('../../src/utils/mailer');

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
});
