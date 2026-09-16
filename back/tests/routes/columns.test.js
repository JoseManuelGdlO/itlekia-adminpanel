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

  it('rejects creating a column on a paused project', async () => {
    const paused = await Project.create({ name: 'Paused columns', status: 'parado' });
    await seedDefaultColumns(paused.id);

    const res = await request(app)
      .post(`/projects/${paused.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: 'Nope' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Project is paused' });
  });

  it('rejects reordering columns on a paused project', async () => {
    const paused = await Project.create({ name: 'Paused reorder', status: 'parado' });
    const cols = await seedDefaultColumns(paused.id);

    const res = await request(app)
      .put(`/projects/${paused.id}/columns/reorder`)
      .set('Cookie', adminCookie)
      .send({ columnIds: cols.map((column) => column.id).reverse() });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Project is paused' });
  });

  it('rejects string column ids when reordering', async () => {
    const listed = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', adminCookie);
    const stringIds = listed.body.map((column) => String(column.id));
    const reordered = await request(app)
      .put(`/projects/${project.id}/columns/reorder`)
      .set('Cookie', adminCookie)
      .send({ columnIds: stringIds });

    expect(reordered.status).toBe(400);
    expect(reordered.body).toEqual({ error: 'Invalid order' });
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

  it('rejects incomplete, duplicate, and foreign reorder ids', async () => {
    const listed = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', adminCookie);
    const ids = listed.body.map((column) => column.id);
    const other = await Project.create({ name: 'Foreign board' });
    const [foreignCol] = await seedDefaultColumns(other.id);

    const incomplete = await request(app)
      .put(`/projects/${project.id}/columns/reorder`)
      .set('Cookie', adminCookie)
      .send({ columnIds: ids.slice(1) });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body).toEqual({ error: 'Invalid order' });

    const duplicate = await request(app)
      .put(`/projects/${project.id}/columns/reorder`)
      .set('Cookie', adminCookie)
      .send({ columnIds: [ids[0], ids[0], ...ids.slice(2)] });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toEqual({ error: 'Invalid order' });

    const foreign = await request(app)
      .put(`/projects/${project.id}/columns/reorder`)
      .set('Cookie', adminCookie)
      .send({ columnIds: [...ids.slice(0, -1), foreignCol.id] });
    expect(foreign.status).toBe(400);
    expect(foreign.body).toEqual({ error: 'Invalid order' });
  });

  it('rejects renaming to a duplicate name', async () => {
    const cols = await BoardColumn.findAll({ where: { projectId: project.id } });
    const review = cols.find((column) => column.name === 'Review');
    const res = await request(app)
      .put(`/projects/${project.id}/columns/${review.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'To Do' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid name' });
  });

  it('returns 404 when renaming or deleting a column from another project', async () => {
    const other = await Project.create({ name: 'Other columns' });
    const [foreignCol] = await seedDefaultColumns(other.id);

    const renamed = await request(app)
      .put(`/projects/${project.id}/columns/${foreignCol.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Hijack' });
    expect(renamed.status).toBe(404);
    expect(renamed.body).toEqual({ error: 'Column not found' });

    const deleted = await request(app)
      .delete(`/projects/${project.id}/columns/${foreignCol.id}`)
      .set('Cookie', adminCookie);
    expect(deleted.status).toBe(404);
    expect(deleted.body).toEqual({ error: 'Column not found' });
  });

  it('returns 404 when listing columns for a missing project', async () => {
    const res = await request(app).get('/projects/999999/columns').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Project not found' });
  });

  it('maps a unique-constraint race on create and rename to Invalid name', async () => {
    const findOneSpy = jest.spyOn(BoardColumn, 'findOne').mockResolvedValueOnce(null);
    const created = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: 'To Do' });
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: 'Invalid name' });
    findOneSpy.mockRestore();

    const review = await BoardColumn.findOne({ where: { projectId: project.id, name: 'Review' } });
    const renameSpy = jest
      .spyOn(BoardColumn, 'findOne')
      .mockResolvedValueOnce(review)
      .mockResolvedValueOnce(null);
    const renamed = await request(app)
      .put(`/projects/${project.id}/columns/${review.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'To Do' });
    expect(renamed.status).toBe(400);
    expect(renamed.body).toEqual({ error: 'Invalid name' });
    renameSpy.mockRestore();
  });

  it('maps a foreign-key constraint on delete to Column not empty', async () => {
    const { ForeignKeyConstraintError } = require('sequelize');
    const done = await BoardColumn.findOne({ where: { projectId: project.id, name: 'Done' } });
    const countSpy = jest.spyOn(Task, 'count').mockResolvedValueOnce(0);
    const destroySpy = jest
      .spyOn(BoardColumn.prototype, 'destroy')
      .mockRejectedValueOnce(new ForeignKeyConstraintError({}));

    const res = await request(app)
      .delete(`/projects/${project.id}/columns/${done.id}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Column not empty' });
    countSpy.mockRestore();
    destroySpy.mockRestore();
  });
});
