process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Note } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('notes routes', () => {
  let ownerCookie;
  let otherCookie;
  let owner;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    owner = await User.create({ name: 'Owner', email: 'owner@example.com', passwordHash: 'x', role: 'developer' });
    const other = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: 'x', role: 'developer' });
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
    await Note.create({ userId: owner.id, title: 'Owner note', content: 'x' });
    const res = await request(app).get('/notes').set('Cookie', otherCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('rejects updating a note owned by someone else', async () => {
    const note = await Note.create({ userId: owner.id, title: 'Owner note 2', content: 'x' });
    const res = await request(app)
      .put(`/notes/${note.id}`)
      .set('Cookie', otherCookie)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
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
});
