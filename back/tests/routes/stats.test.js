process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const {
  sequelize,
  User,
  Project,
  ProjectMember,
  Task,
  BoardColumn,
} = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('stats team', () => {
  let admin;
  let developer;
  let adminCookie;
  let developerCookie;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    admin = await User.create({ name: 'Ada', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('developer is forbidden', async () => {
    const res = await request(app).get('/stats/team').set('Cookie', developerCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('lists admin and developer with membership, buckets, and open hours', async () => {
    const live = await Project.create({ name: 'Live', status: 'trabajando' });
    const paused = await Project.create({ name: 'Hold', status: 'parado' });
    const archived = await Project.create({ name: 'Old', status: 'archivado' });
    const hidden = await Project.create({ name: 'Hidden', status: 'oculto' });
    const [todo, doing, review, done] = await seedDefaultColumns(live.id);
    const [pausedTodo] = await seedDefaultColumns(paused.id);
    const [archTodo] = await seedDefaultColumns(archived.id);
    const [hidTodo] = await seedDefaultColumns(hidden.id);
    await ProjectMember.create({ projectId: live.id, userId: developer.id });
    await ProjectMember.create({ projectId: paused.id, userId: developer.id });
    await ProjectMember.create({ projectId: archived.id, userId: developer.id });
    await Task.create({
      projectId: live.id, title: 'Todo', columnId: todo.id, assigneeId: developer.id, estimatedHours: 2.5,
    });
    await Task.create({
      projectId: live.id, title: 'Doing', columnId: doing.id, assigneeId: developer.id, estimatedHours: null,
    });
    await Task.create({
      projectId: live.id, title: 'Review', columnId: review.id, assigneeId: developer.id, estimatedHours: 1,
    });
    await Task.create({
      projectId: live.id, title: 'Float A', columnId: todo.id, assigneeId: developer.id, estimatedHours: 8.1,
    });
    await Task.create({
      projectId: live.id, title: 'Float B', columnId: review.id, assigneeId: developer.id, estimatedHours: 0.7,
    });
    await Task.create({
      projectId: live.id, title: 'Done', columnId: done.id, assigneeId: developer.id, estimatedHours: 10,
    });
    await Task.create({
      projectId: live.id, title: 'Unassigned', columnId: todo.id, assigneeId: null, estimatedHours: 8,
    });
    await Task.create({
      projectId: hidden.id, title: 'Hidden work', columnId: hidTodo.id, assigneeId: developer.id, estimatedHours: 3,
    });
    await Task.create({
      projectId: archived.id, title: 'Old work', columnId: archTodo.id, assigneeId: developer.id,
    });
    await Task.create({
      projectId: paused.id, title: 'Paused todo', columnId: pausedTodo.id, assigneeId: developer.id, estimatedHours: 0.5,
    });

    const res = await request(app).get('/stats/team').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.members.map((m) => m.id)).toEqual([admin.id, developer.id]);
    const ada = res.body.members[0];
    expect(ada).toEqual({
      id: admin.id,
      name: 'Ada',
      role: 'admin',
      projects: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      estimatedHours: 0,
    });
    const dev = res.body.members[1];
    expect(dev).toEqual({
      id: developer.id,
      name: 'Dev',
      role: 'developer',
      projects: 2,
      todo: 3,
      inProgress: 3,
      done: 1,
      estimatedHours: 12.8,
    });
  });

  it('counts a listed project from assignment even without membership', async () => {
    const live = await Project.create({ name: 'Assigned only', status: 'trabajando' });
    const [todo] = await seedDefaultColumns(live.id);
    await Task.create({
      projectId: live.id,
      title: 'Admin work',
      columnId: todo.id,
      assigneeId: admin.id,
    });
    const res = await request(app).get('/stats/team').set('Cookie', adminCookie);
    const ada = res.body.members.find((m) => m.id === admin.id);
    expect(ada.projects).toBeGreaterThanOrEqual(1);
  });

  it('returns empty members when there are no users', async () => {
    await User.destroy({ where: {} });
    const res = await request(app).get('/stats/team').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ members: [] });
  });
});
