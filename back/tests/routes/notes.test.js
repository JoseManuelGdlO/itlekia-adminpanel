process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Note, NoteNotify, Project, ProjectMember, Task } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('notes routes', () => {
  let ownerCookie;
  let otherCookie;
  let owner;
  let other;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    owner = await User.create({ name: 'Owner', email: 'owner@example.com', passwordHash: 'x', role: 'developer' });
    other = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: 'x', role: 'developer' });
    ownerCookie = `token=${signToken({ id: owner.id, role: 'developer' })}`;
    otherCookie = `token=${signToken({ id: other.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a standalone note for the authenticated user', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Remember', content: 'Follow up with client' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(owner.id);
  });

  it('rejects a note linked to both a project and a task', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Bad', content: 'x', projectId: 1, taskId: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects a reminder note with no remindAt', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Bad reminder', content: 'x', isReminder: true });
    expect(res.status).toBe(400);
  });

  it('creates a valid reminder note', async () => {
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Ping client', content: 'x', isReminder: true, remindAt });
    expect(res.status).toBe(201);
    expect(res.body.isReminder).toBe(true);
  });

  it('only lists notes owned by the requesting user', async () => {
    const note = await Note.create({ userId: owner.id, title: 'Owner note', content: 'x' });

    const otherRes = await request(app).get('/notes').set('Cookie', otherCookie);
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.length).toBe(0);

    const ownerRes = await request(app).get('/notes').set('Cookie', ownerCookie);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.some((n) => n.id === note.id)).toBe(true);
  });

  it('rejects updating a note owned by someone else', async () => {
    const note = await Note.create({ userId: owner.id, title: 'Owner note 2', content: 'x' });
    const res = await request(app)
      .put(`/notes/${note.id}`)
      .set('Cookie', otherCookie)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('rejects deleting a note owned by someone else', async () => {
    const note = await Note.create({ userId: owner.id, title: 'Owner note 4', content: 'x' });
    const res = await request(app).delete(`/notes/${note.id}`).set('Cookie', otherCookie);
    expect(res.status).toBe(403);

    const stillExists = await Note.findByPk(note.id);
    expect(stillExists).not.toBeNull();
  });

  it('owner can update and delete their note', async () => {
    const note = await Note.create({ userId: owner.id, title: 'Owner note 3', content: 'x' });
    const putRes = await request(app)
      .put(`/notes/${note.id}`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Updated' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.title).toBe('Updated');

    const deleteRes = await request(app).delete(`/notes/${note.id}`).set('Cookie', ownerCookie);
    expect(deleteRes.status).toBe(204);
  });

  it('creates a standalone reminder with extra notify users and omits the owner', async () => {
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({
        title: 'Ping extras',
        content: 'x',
        isReminder: true,
        remindAt,
        notifyUserIds: [other.id],
      });
    expect(res.status).toBe(201);
    expect(res.body.notifyUsers).toEqual([{ id: other.id, name: 'Other' }]);
    const rows = await NoteNotify.findAll({ where: { noteId: res.body.id } });
    expect(rows.map((r) => r.userId)).toEqual([other.id]);
    expect(rows.some((r) => r.userId === owner.id)).toBe(false);
  });

  it('rejects a project reminder with a non-member recipient', async () => {
    const project = await Project.create({ name: 'Website Revamp' });
    const title = 'Secret ping';
    const before = await Note.count({ where: { title } });
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({
        title,
        content: 'x',
        isReminder: true,
        remindAt,
        projectId: project.id,
        notifyUserIds: [other.id],
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid recipient' });
    expect(await Note.count({ where: { title } })).toBe(before);
  });

  it('rejects a non-array notifyUserIds without persisting', async () => {
    const title = 'Bad ids shape';
    const before = await Note.count({ where: { title } });
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({
        title,
        content: 'x',
        isReminder: true,
        remindAt,
        notifyUserIds: 1,
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid recipient' });
    expect(await Note.count({ where: { title } })).toBe(before);
  });

  it('rejects non-finite notifyUserIds without persisting', async () => {
    const title = 'Bad ids finite';
    const before = await Note.count({ where: { title } });
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({
        title,
        content: 'x',
        isReminder: true,
        remindAt,
        notifyUserIds: ['abc'],
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid recipient' });
    expect(await Note.count({ where: { title } })).toBe(before);
  });

  it('rejects a task reminder with a non-member of the task project', async () => {
    const project = await Project.create({ name: 'Task Project' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const task = await Task.create({
      projectId: project.id,
      title: 'Do thing',
      columnId: todoCol.id,
    });
    const title = 'Task ping outsider';
    const before = await Note.count({ where: { title } });
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({
        title,
        content: 'x',
        isReminder: true,
        remindAt,
        taskId: task.id,
        notifyUserIds: [other.id],
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid recipient' });
    expect(await Note.count({ where: { title } })).toBe(before);
  });

  it('creates a task reminder with a member of the task project', async () => {
    const project = await Project.create({ name: 'Task Member Project' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const task = await Task.create({
      projectId: project.id,
      title: 'Do member thing',
      columnId: todoCol.id,
    });
    await ProjectMember.create({ projectId: project.id, userId: other.id });
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({
        title: 'Task ping member',
        content: 'x',
        isReminder: true,
        remindAt,
        taskId: task.id,
        notifyUserIds: [other.id],
      });
    expect(res.status).toBe(201);
    expect(res.body.notifyUsers).toEqual([{ id: other.id, name: 'Other' }]);
  });

  it('includes notifyUsers when listing notes', async () => {
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const created = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({
        title: 'Listed extras',
        content: 'x',
        isReminder: true,
        remindAt,
        notifyUserIds: [other.id],
      });
    const res = await request(app).get('/notes').set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    const found = res.body.find((n) => n.id === created.body.id);
    expect(found.notifyUsers).toEqual([{ id: other.id, name: 'Other' }]);
  });
});
