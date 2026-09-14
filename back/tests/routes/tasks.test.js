process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('tasks routes', () => {
  let adminCookie;
  let developerCookie;
  let otherDeveloperCookie;
  let project;
  let assignedTask;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    const otherDeveloper = await User.create({ name: 'Dev2', email: 'dev2@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    otherDeveloperCookie = `token=${signToken({ id: otherDeveloper.id, role: 'developer' })}`;

    project = await Project.create({ name: 'Website Revamp' });
    assignedTask = await Task.create({ projectId: project.id, title: 'Build homepage', assigneeId: developer.id });
    await Task.create({ projectId: project.id, title: 'Not assigned to dev' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('developer listing tasks only sees their own regardless of query params', async () => {
    const res = await request(app)
      .get(`/tasks?projectId=${project.id}`)
      .set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(assignedTask.id);
  });

  it('admin creates a task', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'New task' });
    expect(res.status).toBe(201);
  });

  it('developer cannot create a task', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: project.id, title: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('assignee can PATCH the status of their task', async () => {
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/status`)
      .set('Cookie', developerCookie)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('a different developer cannot PATCH the status of a task not assigned to them', async () => {
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/status`)
      .set('Cookie', otherDeveloperCookie)
      .send({ status: 'done' });
    expect(res.status).toBe(403);
  });

  it('a different developer cannot PUT a task not assigned to them', async () => {
    const res = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', otherDeveloperCookie)
      .send({ description: 'Trying to sneak in an update' });
    expect(res.status).toBe(403);
  });

  it('assignee PUT only applies the description field, ignoring others', async () => {
    const res = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', developerCookie)
      .send({ description: 'Updated details', title: 'Hijacked title' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated details');
    expect(res.body.title).toBe('Build homepage');
  });

  it('admin deletes a task', async () => {
    const toDelete = await Task.create({ projectId: project.id, title: 'Temp' });
    const res = await request(app).delete(`/tasks/${toDelete.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });
});
