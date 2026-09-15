process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, ProjectMember, Task, BoardColumn } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('column routes', () => {
  let adminCookie;
  let memberCookie;
  let outsiderCookie;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const member = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    const outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    memberCookie = `token=${signToken({ id: member.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: member.id });
    await seedDefaultColumns(project.id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('member lists columns in position order; outsider is forbidden', async () => {
    const ok = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', memberCookie);
    expect(ok.status).toBe(200);
    expect(ok.body.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
    expect(ok.body[0].storedName).toBeUndefined();
    const no = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', outsiderCookie);
    expect(no.status).toBe(403);
    expect(no.body).toEqual({ error: 'Forbidden' });
  });

  it('admin creates, renames, reorders, and deletes an empty column', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: '  Blocked  ' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Blocked');

    const renamed = await request(app)
      .put(`/projects/${project.id}/columns/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Waiting' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Waiting');

    const listed = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', adminCookie);
    const ids = listed.body.map((c) => c.id);
    const reversed = [...ids].reverse();
    const reordered = await request(app)
      .put(`/projects/${project.id}/columns/reorder`)
      .set('Cookie', adminCookie)
      .send({ columnIds: reversed });
    expect(reordered.status).toBe(200);
    expect(reordered.body.map((c) => c.id)).toEqual(reversed);

    const del = await request(app)
      .delete(`/projects/${project.id}/columns/${created.body.id}`)
      .set('Cookie', adminCookie);
    expect(del.status).toBe(204);
  });

  it('rejects empty name, duplicate name, delete with tasks, and developer writes', async () => {
    const cols = await BoardColumn.findAll({ where: { projectId: project.id } });
    const empty = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: '   ' });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: 'Invalid name' });

    const dup = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: 'To Do' });
    expect(dup.status).toBe(400);

    const todo = cols.find((c) => c.name === 'To Do');
    await Task.create({ projectId: project.id, title: 'Stay', columnId: todo.id });
    const blocked = await request(app)
      .delete(`/projects/${project.id}/columns/${todo.id}`)
      .set('Cookie', adminCookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({ error: 'Column not empty' });

    const post = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', memberCookie)
      .send({ name: 'Nope' });
    expect(post.status).toBe(403);
  });
});
