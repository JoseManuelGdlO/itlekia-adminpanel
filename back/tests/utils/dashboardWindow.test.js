const {
  DASHBOARD_TZ,
  calendarDateInTz,
  todayDateString,
  taskBucket,
  reminderBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
} = require('../../src/utils/dashboardWindow');

function mexicoNoon(ymd) {
  return new Date(`${ymd}T18:00:00.000Z`);
}

describe('dashboardWindow', () => {
  const today = '2026-09-17';
  const now = mexicoNoon(today);

  it('uses America/Mexico_City', () => {
    expect(DASHBOARD_TZ).toBe('America/Mexico_City');
  });

  it('maps noon UTC-6 to that calendar day', () => {
    expect(calendarDateInTz(now)).toBe(today);
    expect(todayDateString(now)).toBe(today);
  });

  it('maps early UTC morning to the previous CDMX day', () => {
    expect(calendarDateInTz(new Date('2026-09-17T05:00:00.000Z'))).toBe('2026-09-16');
  });

  it('buckets tasks overdue, today, and future/missing as null', () => {
    expect(taskBucket(mexicoNoon('2026-09-16'), today)).toBe('overdue');
    expect(taskBucket(mexicoNoon(today), today)).toBe('today');
    expect(taskBucket(mexicoNoon('2026-09-18'), today)).toBeNull();
    expect(taskBucket(null, today)).toBeNull();
  });

  it('includes overdue reminders only when not yet notified', () => {
    expect(reminderBucket(mexicoNoon('2026-09-16'), null, today)).toBe('overdue');
    expect(reminderBucket(mexicoNoon('2026-09-16'), now, today)).toBeNull();
  });

  it('includes today reminders even after notify', () => {
    expect(reminderBucket(mexicoNoon(today), now, today)).toBe('today');
    expect(reminderBucket(mexicoNoon(today), null, today)).toBe('today');
  });

  it('picks the rightmost column per project (position, then id)', () => {
    const ids = rightmostColumnIds([
      { id: 1, projectId: 10, position: 0 },
      { id: 2, projectId: 10, position: 3 },
      { id: 3, projectId: 10, position: 3 },
      { id: 4, projectId: 11, position: 1 },
    ]);
    expect([...ids].sort()).toEqual([3, 4]);
  });

  it('isoAt returns toISOString or null', () => {
    const d = mexicoNoon(today);
    expect(isoAt(d)).toBe(d.toISOString());
    expect(isoAt(null)).toBeNull();
  });

  it('sorts overdue tasks, today tasks, reminders, then paused projects', () => {
    const items = [
      { kind: 'project', id: 2, title: 'Zeta', at: null, bucket: 'paused', projectId: 2, projectName: 'Zeta', taskId: null },
      { kind: 'project', id: 1, title: 'Alfa', at: null, bucket: 'paused', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'feature_reminder', id: 8, title: 'F', at: mexicoNoon(today).toISOString(), bucket: 'today', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'note_reminder', id: 7, title: 'N', at: mexicoNoon(today).toISOString(), bucket: 'today', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'task', id: 5, title: 'T2', at: mexicoNoon(today).toISOString(), bucket: 'today', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'task', id: 4, title: 'T1', at: mexicoNoon('2026-09-10').toISOString(), bucket: 'overdue', projectId: 1, projectName: 'Alfa', taskId: null },
    ];
    expect(sortDashboardItems(items).map((i) => i.kind)).toEqual([
      'task',
      'task',
      'note_reminder',
      'feature_reminder',
      'project',
      'project',
    ]);
    expect(sortDashboardItems(items).filter((i) => i.kind === 'project').map((i) => i.projectName)).toEqual([
      'Alfa',
      'Zeta',
    ]);
  });

  it('counts pulse from items and keeps reminders out of task totals', () => {
    expect(
      countPulse([
        { kind: 'task', bucket: 'overdue' },
        { kind: 'task', bucket: 'today' },
        { kind: 'note_reminder', bucket: 'overdue' },
        { kind: 'feature_reminder', bucket: 'today' },
        { kind: 'project', bucket: 'paused' },
      ])
    ).toEqual({ overdue: 1, today: 1, remindersToday: 2, paused: 1 });
  });
});
