process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember, BoardColumn } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('task activities routes', () => {
  let adminCookie;
  let developerCookie;
  let outsiderCookie;
  let task;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    const outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    await seedDefaultColumns(project.id);
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    const created = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Build homepage', assigneeId: developer.id });
    task = created.body;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('lists created then status_changed in order', async () => {
    const columns = await BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC']],
    });
    const inProgress = columns[1];
    const moved = await request(app)
      .patch(`/tasks/${task.id}/column`)
      .set('Cookie', developerCookie)
      .send({ columnId: inProgress.id });
    expect(moved.status).toBe(200);

    const same = await request(app)
      .patch(`/tasks/${task.id}/column`)
      .set('Cookie', developerCookie)
      .send({ columnId: inProgress.id });
    expect(same.status).toBe(200);

    const res = await request(app).get(`/tasks/${task.id}/activities`).set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        type: 'created',
        fromStatus: null,
        toStatus: 'To Do',
        user: { id: expect.any(Number), name: 'Admin' },
      })
    );
    expect(res.body[1]).toEqual(
      expect.objectContaining({
        type: 'status_changed',
        fromStatus: 'To Do',
        toStatus: 'In Progress',
        user: { id: expect.any(Number), name: 'Dev' },
      })
    );
  });

  it('forbids a non-member from reading activities', async () => {
    const res = await request(app).get(`/tasks/${task.id}/activities`).set('Cookie', outsiderCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('still lists activities when the actor user is missing', async () => {
    const isolated = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Orphan historial' });
    expect(isolated.status).toBe(201);

    await sequelize.query('PRAGMA foreign_keys = OFF');
    await sequelize.getQueryInterface().bulkInsert('TaskActivities', [
      {
        taskId: isolated.body.id,
        userId: 99999,
        type: 'created',
        fromStatus: null,
        toStatus: 'To Do',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await sequelize.query('PRAGMA foreign_keys = ON');

    const res = await request(app)
      .get(`/tasks/${isolated.body.id}/activities`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    const orphan = res.body.find((row) => row.user && (row.user.name === 'Usuario' || row.user.id === 99999));
    expect(orphan).toBeDefined();
  });

  it('records an assignee change in the historial', async () => {
    const other = await User.create({
      name: 'Luis',
      email: 'luis-act@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await ProjectMember.create({ projectId: project.id, userId: other.id });

    const fresh = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Reassign me', assigneeId: other.id });
    expect(fresh.status).toBe(201);

    const columns = await BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC']],
    });
    const developerUser = await User.findOne({ where: { email: 'dev@example.com' } });
    const changed = await request(app)
      .put(`/tasks/${fresh.body.id}`)
      .set('Cookie', adminCookie)
      .send({ assigneeId: developerUser.id });
    expect(changed.status).toBe(200);

    const res = await request(app).get(`/tasks/${fresh.body.id}/activities`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.some((row) => row.type === 'assignee_changed')).toBe(true);
  });
});
