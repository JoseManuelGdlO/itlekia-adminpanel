const { buildReminderIcs } = require('../../src/utils/reminderIcs');

describe('buildReminderIcs', () => {
  it('emits a 30-minute PUBLISH event in UTC', () => {
    const ics = buildReminderIcs({
      uid: 'note-9@intelekia',
      title: 'Ping client',
      description: 'Send status',
      start: new Date('2026-09-15T20:05:00.000Z'),
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain('UID:note-9@intelekia');
    expect(ics).toContain('DTSTART:20260915T200500Z');
    expect(ics).toContain('DTEND:20260915T203500Z');
    expect(ics).toContain('SUMMARY:Ping client');
  });
});
