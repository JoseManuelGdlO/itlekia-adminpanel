process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');
const { signToken } = require('../../src/utils/jwt');

describe('users routes', () => {
  let adminCookie;
  let developerCookie;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'admin',
    });
    const developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'developer',
    });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('lists users for an admin', async () => {
    const res = await request(app).get('/users').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].passwordHash).toBeUndefined();
  });

  it('rejects listing users for a developer', async () => {
    const res = await request(app).get('/users').set('Cookie', developerCookie);
    expect(res.status).toBe(403);
  });

  it('creates a new developer as admin', async () => {
    const res = await request(app)
      .post('/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Dev Two', email: 'dev2@example.com', password: 'secret123', role: 'developer' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('dev2@example.com');
  });

  it('updates a user as admin', async () => {
    const created = await User.create({
      name: 'Temp',
      email: 'temp@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'developer',
    });
    const res = await request(app)
      .put(`/users/${created.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('deletes a user as admin', async () => {
    const created = await User.create({
      name: 'ToDelete',
      email: 'delete@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'developer',
    });
    const res = await request(app).delete(`/users/${created.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
    expect(await User.findByPk(created.id)).toBeNull();
  });
});
