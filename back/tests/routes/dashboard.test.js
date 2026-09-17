process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const {
  sequelize,
  User,
  Project,
  Task,
  Note,
  ProjectMember,
  Feature,
  NoteNotify,
  FeatureNotify,
} = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');
const { todayDateString } = require('../../src/utils/dashboardWindow');

function mexicoNoon(ymd) {
  return new Date(`${ymd}T18:00:00.000Z`);
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const EMPTY = {
  pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
  items: [],
};

describe('dashboard routes', () => {
  let admin;
  let developer;
  let other;
  let adminCookie;
  let developerCookie;
  let otherCookie;
  let today;
  let yesterday;
  let tomorrow;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    other = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    otherCookie = `token=${signToken({ id: other.id, role: 'developer' })}`;
    today = todayDateString(new Date());
    yesterday = addDays(today, -1);
    tomorrow = addDays(today, 1);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  async function board(name, status = 'trabajando') {
    const project = await Project.create({ name, status });
    const cols = await seedDefaultColumns(project.id);
    return { project, todo: cols[0], done: cols[cols.length - 1] };
  }

  function taskItem(task, project, bucket) {
    return {
      kind: 'task',
      id: task.id,
      title: task.title,
      at: new Date(task.dueDate).toISOString(),
      bucket,
      projectId: project.id,
      projectName: project.name,
      taskId: null,
    };
  }

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not authenticated' });
  });

  it('returns an empty payload for a developer with no work', async () => {
    const res = await request(app).get('/dashboard').set('Cookie', otherCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY);
  });

  it('lists the developer assigned overdue and today tasks and hides the rest', async () => {
    const { project, todo, done } = await board('Mine');
    await ProjectMember.create({ projectId: project.id, userId: developer.id });

    const overdue = await Task.create({
      projectId: project.id,
      title: 'Late',
      assigneeId: developer.id,
      columnId: todo.id,
      dueDate: mexicoNoon(yesterday),
    });
    const dueToday = await Task.create({
      projectId: project.id,
      title: 'Today',
      assigneeId: developer.id,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });
    await Task.create({
      projectId: project.id,
      title: 'No date',
      assigneeId: developer.id,
      columnId: todo.id,
    });
    await Task.create({
      projectId: project.id,
      title: 'Tomorrow',
      assigneeId: developer.id,
      columnId: todo.id,
      dueDate: mexicoNoon(tomorrow),
    });
    await Task.create({
      projectId: project.id,
      title: 'Done today',
      assigneeId: developer.id,
      columnId: done.id,
      dueDate: mexicoNoon(today),
    });
    await Task.create({
      projectId: project.id,
      title: 'Someone else',
      assigneeId: admin.id,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });
    await Task.create({
      projectId: project.id,
      title: 'Unassigned',
      assigneeId: null,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });

    const archived = await board('Old', 'archivado');
    await ProjectMember.create({ projectId: archived.project.id, userId: developer.id });
    await Task.create({
      projectId: archived.project.id,
      title: 'Archived task',
      assigneeId: developer.id,
      columnId: archived.todo.id,
      dueDate: mexicoNoon(today),
    });

    const res = await request(app).get('/dashboard').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      taskItem(overdue, project, 'overdue'),
      taskItem(dueToday, project, 'today'),
    ]);
    expect(res.body.pulse).toEqual({ overdue: 1, today: 1, remindersToday: 0, paused: 0 });
  });

  it('lets admin see unassigned and other people dated tasks', async () => {
    const { project, todo } = await board('Admin view');
    const unassigned = await Task.create({
      projectId: project.id,
      title: 'Open',
      assigneeId: null,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });

    const res = await request(app).get('/dashboard').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.items.some((item) => item.id === unassigned.id && item.kind === 'task')).toBe(true);
  });

  it('lists note and feature reminders the developer owns or is notified of', async () => {
    const { project, todo } = await board('Reminders');
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    const linkedTask = await Task.create({
      projectId: project.id,
      title: 'Has note',
      assigneeId: developer.id,
      columnId: todo.id,
    });

    const owned = await Note.create({
      userId: developer.id,
      title: 'Call client',
      content: 'x',
      isReminder: true,
      remindAt: mexicoNoon(today),
    });
    const extra = await Note.create({
      userId: admin.id,
      title: 'Ping extra',
      content: 'x',
      projectId: project.id,
      isReminder: true,
      remindAt: mexicoNoon(today),
    });
    await NoteNotify.create({ noteId: extra.id, userId: developer.id });
    const taskNote = await Note.create({
      userId: developer.id,
      title: 'Task ping',
      content: 'x',
      taskId: linkedTask.id,
      isReminder: true,
      remindAt: mexicoNoon(yesterday),
    });
    await Note.create({
      userId: admin.id,
      title: 'Not for me',
      content: 'x',
      isReminder: true,
      remindAt: mexicoNoon(today),
    });
    await Note.create({
      userId: developer.id,
      title: 'Already mailed',
      content: 'x',
      isReminder: true,
      remindAt: mexicoNoon(yesterday),
      notifiedAt: mexicoNoon(yesterday),
    });

    const feature = await Feature.create({
      projectId: project.id,
      userId: admin.id,
      title: 'Ship SSO',
      isReminder: true,
      remindAt: mexicoNoon(today),
      status: 'done',
    });
    await FeatureNotify.create({ featureId: feature.id, userId: developer.id });

    const archived = await board('Archived reminders', 'archivado');
    await ProjectMember.create({ projectId: archived.project.id, userId: developer.id });
    await Note.create({
      userId: developer.id,
      title: 'Hidden note',
      content: 'x',
      projectId: archived.project.id,
      isReminder: true,
      remindAt: mexicoNoon(today),
    });

    const res = await request(app).get('/dashboard').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    const reminderTitles = res.body.items
      .filter((item) => item.kind === 'note_reminder' || item.kind === 'feature_reminder')
      .map((item) => item.title);
    expect(reminderTitles).toEqual(expect.arrayContaining([
      'Call client',
      'Ping extra',
      'Ship SSO',
      'Task ping',
    ]));
    expect(reminderTitles).not.toContain('Not for me');
    expect(reminderTitles).not.toContain('Already mailed');
    expect(reminderTitles).not.toContain('Hidden note');
    const standalone = res.body.items.find((item) => item.id === owned.id && item.kind === 'note_reminder');
    expect(standalone).toMatchObject({
      kind: 'note_reminder',
      projectId: null,
      projectName: null,
      taskId: null,
      bucket: 'today',
    });
    const fromTask = res.body.items.find((item) => item.id === taskNote.id && item.kind === 'note_reminder');
    expect(fromTask).toMatchObject({
      kind: 'note_reminder',
      projectId: project.id,
      projectName: project.name,
      taskId: linkedTask.id,
      bucket: 'overdue',
    });
    const feat = res.body.items.find((item) => item.kind === 'feature_reminder' && item.id === feature.id);
    expect(feat).toMatchObject({
      id: feature.id,
      title: 'Ship SSO',
      projectId: project.id,
      taskId: null,
      bucket: 'today',
    });
    expect(res.body.pulse.remindersToday).toBeGreaterThanOrEqual(4);
  });
});
