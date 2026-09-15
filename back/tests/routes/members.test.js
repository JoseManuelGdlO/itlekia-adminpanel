process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('project members routes', () => {
  let adminCookie;
  let developerCookie;
  let outsiderCookie;
  let project;
  let developer;
  let outsider;
  let todoCol;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    [todoCol] = await seedDefaultColumns(project.id);
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    await Task.create({
      projectId: project.id,
      title: 'Keep me',
      assigneeId: developer.id,
      columnId: todoCol.id,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('member can list members; outsider cannot', async () => {
    const ok = await request(app).get(`/projects/${project.id}/members`).set('Cookie', developerCookie);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual([
      expect.objectContaining({ id: developer.id, name: 'Dev', email: 'dev@example.com', role: 'developer' }),
    ]);
    expect(ok.body[0].passwordHash).toBeUndefined();

    const denied = await request(app).get(`/projects/${project.id}/members`).set('Cookie', outsiderCookie);
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: 'Forbidden' });
  });

  it('admin adds a member and rejects duplicates', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/members`)
      .set('Cookie', adminCookie)
      .send({ userId: outsider.id });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({ id: outsider.id, email: 'out@example.com' })
    );

    const dup = await request(app)
      .post(`/projects/${project.id}/members`)
      .set('Cookie', adminCookie)
      .send({ userId: outsider.id });
    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ error: 'Already a member' });
  });

  it('developer cannot add or remove members', async () => {
    const post = await request(app)
      .post(`/projects/${project.id}/members`)
      .set('Cookie', developerCookie)
      .send({ userId: outsider.id });
    expect(post.status).toBe(403);

    const del = await request(app)
      .delete(`/projects/${project.id}/members/${outsider.id}`)
      .set('Cookie', developerCookie);
    expect(del.status).toBe(403);
  });

  it('admin remove does not delete tasks', async () => {
    const removedDeveloper = await User.create({
      name: 'Removed',
      email: 'removed@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await ProjectMember.create({ projectId: project.id, userId: removedDeveloper.id });
    await Task.create({
      projectId: project.id,
      title: 'Preserved after membership removal',
      assigneeId: removedDeveloper.id,
      columnId: todoCol.id,
    });

    const del = await request(app)
      .delete(`/projects/${project.id}/members/${removedDeveloper.id}`)
      .set('Cookie', adminCookie);
    expect(del.status).toBe(204);

    const missing = await request(app)
      .delete(`/projects/${project.id}/members/${removedDeveloper.id}`)
      .set('Cookie', adminCookie);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Member not found' });

    const tasks = await Task.findAll({ where: { assigneeId: removedDeveloper.id } });
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('returns 404 for a missing project', async () => {
    const res = await request(app).get('/projects/9999/members').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Project not found' });
  });
});
