const { parseRemindAt } = require('../../src/utils/remindAt');

describe('parseRemindAt', () => {
  it('accepts a date-only value for today', () => {
    const parsed = parseRemindAt('2026-09-18');
    expect(parsed).toBeInstanceOf(Date);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('accepts a datetime-local value', () => {
    const parsed = parseRemindAt('2026-09-18T10:00');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.getHours()).toBe(10);
  });

  it('returns null for empty values', () => {
    expect(parseRemindAt(null)).toBeNull();
    expect(parseRemindAt('')).toBeNull();
  });
});
