process.env.JWT_SECRET = 'test-secret';
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.FINANCE_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-'));

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('finance routes', () => {
  let adminCookie;
  let developerCookie;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
  });

  afterAll(async () => {
    await sequelize.close();
    fs.rmSync(process.env.FINANCE_UPLOAD_DIR, { recursive: true, force: true });
  });

  it('admin creates lists and deletes a finance item; JSON has hasFile and no storedName', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'Hosting')
      .field('amount', '49.99')
      .field('notes', 'Yearly');
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        kind: 'cost',
        title: 'Hosting',
        amount: 49.99,
        notes: 'Yearly',
        hasFile: false,
      })
    );
    expect(created.body.storedName).toBeUndefined();

    const listed = await request(app).get(`/projects/${project.id}/finance`).set('Cookie', adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const del = await request(app)
      .delete(`/projects/${project.id}/finance/${created.body.id}`)
      .set('Cookie', adminCookie);
    expect(del.status).toBe(204);
  });

  it('developer cannot list or create finance items', async () => {
    const get = await request(app).get(`/projects/${project.id}/finance`).set('Cookie', developerCookie);
    expect(get.status).toBe(403);
    expect(get.body).toEqual({ error: 'Forbidden' });
    const post = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', developerCookie)
      .field('kind', 'cost')
      .field('title', 'Nope')
      .field('amount', '1');
    expect(post.status).toBe(403);
  });

  it('rejects invalid amount and kind', async () => {
    const amount = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'X')
      .field('amount', '-1');
    expect(amount.status).toBe(400);
    expect(amount.body).toEqual({ error: 'Invalid amount' });

    const kind = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'invoice')
      .field('title', 'X')
      .field('amount', '1');
    expect(kind.status).toBe(400);
    expect(kind.body).toEqual({ error: 'Invalid kind' });
  });

  it('uploads a pdf, downloads it, and 404s when there is no file', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'contract')
      .field('title', 'SOW')
      .field('amount', '1000')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'sow.pdf', contentType: 'application/pdf' });
    expect(created.status).toBe(201);
    expect(created.body.hasFile).toBe(true);
    expect(created.body.fileName).toBe('sow.pdf');

    const file = await request(app)
      .get(`/projects/${project.id}/finance/${created.body.id}/file`)
      .set('Cookie', adminCookie);
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toMatch(/sow\.pdf/);

    const empty = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'budget')
      .field('title', 'Cap')
      .field('amount', '5000');
    const missing = await request(app)
      .get(`/projects/${project.id}/finance/${empty.body.id}/file`)
      .set('Cookie', adminCookie);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'File not found' });

    const forbidden = await request(app)
      .get(`/projects/${project.id}/finance/${created.body.id}/file`)
      .set('Cookie', developerCookie);
    expect(forbidden.status).toBe(403);
  });
});
