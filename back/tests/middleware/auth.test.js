process.env.JWT_SECRET = 'test-secret';
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { signToken } = require('../../src/utils/jwt');
const { requireAuth, requireRole } = require('../../src/middleware/auth');

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.get('/protected', requireAuth, (req, res) => res.json({ user: req.user }));
  app.get('/admin-only', requireAuth, requireRole('admin'), (req, res) =>
    res.json({ ok: true })
  );
  return app;
}

describe('auth middleware', () => {
  const app = buildApp();

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid token and exposes req.user', async () => {
    const token = signToken({ id: 5, role: 'developer' });
    const res = await request(app).get('/protected').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 5, role: 'developer' });
  });

  it('rejects a developer on an admin-only route', async () => {
    const token = signToken({ id: 5, role: 'developer' });
    const res = await request(app).get('/admin-only').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin on an admin-only route', async () => {
    const token = signToken({ id: 1, role: 'admin' });
    const res = await request(app).get('/admin-only').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
  });
});
