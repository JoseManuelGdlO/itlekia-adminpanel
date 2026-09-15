process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('notify-users routes', () => {
  let developerCookie;
  let other;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    other = await User.create({
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects listing users for a developer', async () => {
    const res = await request(app).get('/users').set('Cookie', developerCookie);
    expect(res.status).toBe(403);
  });

  it('lists notify users without the caller', async () => {
    const res = await request(app).get('/notify-users').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: other.id, name: 'Ada' }]);
  });
});
