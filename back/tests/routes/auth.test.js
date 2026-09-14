process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');

describe('auth routes', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'admin',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('logs in with correct credentials and sets a token cookie', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@example.com');
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('rejects wrong credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns the current user from /auth/me when authenticated', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'secret123' });
    const cookie = login.headers['set-cookie'][0];

    const res = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@example.com');
  });

  it('rejects /auth/me with no cookie', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
