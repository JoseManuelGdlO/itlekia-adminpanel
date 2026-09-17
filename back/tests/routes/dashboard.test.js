process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

const EMPTY = {
  pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
  items: [],
};

describe('dashboard routes', () => {
  let otherCookie;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const other = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: 'x', role: 'developer' });
    otherCookie = `token=${signToken({ id: other.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not authenticated' });
  });

  it('returns an empty payload for a developer with no work', async () => {
    const res = await request(app).get('/dashboard').set('Cookie', otherCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY);
  });
});
