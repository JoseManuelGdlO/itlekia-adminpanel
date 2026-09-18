import { describe, it, expect } from 'vitest';
import { joinDateTime, splitDateTime, todayInputDate } from './localDateTime';

describe('localDateTime', () => {
  it('joins a date and time for reminders including today', () => {
    expect(joinDateTime('2026-09-18', '09:00')).toBe('2026-09-18T09:00');
    expect(joinDateTime('2026-09-18', '')).toBe('2026-09-18T09:00');
  });

  it('splits a datetime-local or date-only value', () => {
    expect(splitDateTime('2026-09-18T10:00')).toEqual({ date: '2026-09-18', time: '10:00' });
    expect(splitDateTime('2026-09-18')).toEqual({ date: '2026-09-18', time: '09:00' });
  });

  it('formats today as an input date', () => {
    expect(todayInputDate(new Date(2026, 8, 18, 11, 0))).toBe('2026-09-18');
  });
});
