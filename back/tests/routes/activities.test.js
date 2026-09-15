process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
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
    const moved = await request(app)
      .patch(`/tasks/${task.id}/status`)
      .set('Cookie', developerCookie)
      .send({ status: 'in_progress' });
    expect(moved.status).toBe(200);

    const same = await request(app)
      .patch(`/tasks/${task.id}/status`)
      .set('Cookie', developerCookie)
      .send({ status: 'in_progress' });
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
});
