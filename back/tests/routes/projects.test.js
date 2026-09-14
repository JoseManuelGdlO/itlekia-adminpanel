process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('projects routes', () => {
  let adminCookie;
  let developerCookie;
  let assignedProject;
  let otherProject;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;

    assignedProject = await Project.create({ name: 'Assigned Project' });
    otherProject = await Project.create({ name: 'Other Project' });
    await Task.create({ projectId: assignedProject.id, title: 'A task', assigneeId: developer.id });
    await Task.create({ projectId: otherProject.id, title: 'Not mine' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('admin sees all projects', async () => {
    const res = await request(app).get('/projects').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('developer only sees projects with tasks assigned to them', async () => {
    const res = await request(app).get('/projects').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Assigned Project');
  });

  it('admin creates a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'New Project', description: 'desc' });
    expect(res.status).toBe(201);
  });

  it('developer cannot create a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', developerCookie)
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('admin updates and deletes a project', async () => {
    const putRes = await request(app)
      .put(`/projects/${otherProject.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'archived' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe('archived');

    const deleteRes = await request(app).delete(`/projects/${otherProject.id}`).set('Cookie', adminCookie);
    expect(deleteRes.status).toBe(204);
  });
});
