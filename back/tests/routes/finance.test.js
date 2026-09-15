process.env.JWT_SECRET = 'test-secret';
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.FINANCE_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-'));

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, FinanceItem } = require('../../src/models');
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

  it('updates title, amount, and kind with public JSON only', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'Draft')
      .field('amount', '10');

    const updated = await request(app)
      .put(`/projects/${project.id}/finance/${created.body.id}`)
      .set('Cookie', adminCookie)
      .field('kind', 'budget')
      .field('title', 'Approved')
      .field('amount', '25.50');

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        kind: 'budget',
        title: 'Approved',
        amount: 25.5,
        hasFile: false,
      })
    );
    expect(updated.body.storedName).toBeUndefined();
  });

  it('replaces a file, removes the old file, and downloads the new file', async () => {
    const oldContents = Buffer.from('%PDF-1.4 old');
    const newContents = Buffer.from('new image contents');
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'contract')
      .field('title', 'Replace file')
      .field('amount', '100')
      .attach('file', oldContents, { filename: 'old.pdf', contentType: 'application/pdf' });
    const oldStoredName = (await FinanceItem.findByPk(created.body.id)).storedName;
    const oldPath = path.join(process.env.FINANCE_UPLOAD_DIR, oldStoredName);

    const updated = await request(app)
      .put(`/projects/${project.id}/finance/${created.body.id}`)
      .set('Cookie', adminCookie)
      .attach('file', newContents, { filename: 'new.png', contentType: 'image/png' });

    expect(updated.status).toBe(200);
    expect(updated.body.hasFile).toBe(true);
    expect(updated.body.fileName).toBe('new.png');
    expect(fs.existsSync(oldPath)).toBe(false);

    const downloaded = await request(app)
      .get(`/projects/${project.id}/finance/${created.body.id}/file`)
      .set('Cookie', adminCookie)
      .buffer(true);
    expect(downloaded.status).toBe(200);
    expect(downloaded.body).toEqual(newContents);
  });

  it('deletes the disk file when deleting an item', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'Delete file')
      .field('amount', '9')
      .attach('file', Buffer.from('%PDF delete'), { filename: 'delete.pdf', contentType: 'application/pdf' });
    const storedName = (await FinanceItem.findByPk(created.body.id)).storedName;
    const storedPath = path.join(process.env.FINANCE_UPLOAD_DIR, storedName);
    expect(fs.existsSync(storedPath)).toBe(true);

    const deleted = await request(app)
      .delete(`/projects/${project.id}/finance/${created.body.id}`)
      .set('Cookie', adminCookie);

    expect(deleted.status).toBe(204);
    expect(fs.existsSync(storedPath)).toBe(false);
  });

  it('rejects invalid file MIME types', async () => {
    const response = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'Text file')
      .field('amount', '1')
      .attach('file', Buffer.from('plain text'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid file type' });
  });

  it('rejects files larger than 10 MB', async () => {
    const response = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'Large file')
      .field('amount', '1')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'File too large' });
  });

  it('returns 404 when file metadata exists but the disk file is missing', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'contract')
      .field('title', 'Missing disk file')
      .field('amount', '100')
      .attach('file', Buffer.from('%PDF missing'), { filename: 'missing.pdf', contentType: 'application/pdf' });
    const item = await FinanceItem.findByPk(created.body.id);
    fs.unlinkSync(path.join(process.env.FINANCE_UPLOAD_DIR, item.storedName));

    const response = await request(app)
      .get(`/projects/${project.id}/finance/${created.body.id}/file`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'File not found' });
  });

  it('removes the row and any partial file when create file storage fails', async () => {
    const originalWrite = fs.writeFileSync;
    const filesBefore = new Set(fs.readdirSync(process.env.FINANCE_UPLOAD_DIR));
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementationOnce((...args) => {
      originalWrite(...args);
      throw new Error('disk write failed');
    });

    const response = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'Failed create')
      .field('amount', '5')
      .attach('file', Buffer.from('%PDF partial'), { filename: 'partial.pdf', contentType: 'application/pdf' });
    writeSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(await FinanceItem.findOne({ where: { title: 'Failed create' } })).toBeNull();
    expect(fs.readdirSync(process.env.FINANCE_UPLOAD_DIR).filter((name) => !filesBefore.has(name))).toEqual([]);
  });

  it('keeps the old file and metadata when replacement file storage fails', async () => {
    const oldContents = Buffer.from('%PDF stable');
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'contract')
      .field('title', 'Stable item')
      .field('amount', '100')
      .attach('file', oldContents, { filename: 'stable.pdf', contentType: 'application/pdf' });
    const before = await FinanceItem.findByPk(created.body.id);
    const oldPath = path.join(process.env.FINANCE_UPLOAD_DIR, before.storedName);
    const filesBefore = new Set(fs.readdirSync(process.env.FINANCE_UPLOAD_DIR));
    const originalWrite = fs.writeFileSync;
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementationOnce((...args) => {
      originalWrite(...args);
      throw new Error('disk write failed');
    });

    const response = await request(app)
      .put(`/projects/${project.id}/finance/${created.body.id}`)
      .set('Cookie', adminCookie)
      .field('title', 'Changed title')
      .attach('file', Buffer.from('partial replacement'), {
        filename: 'replacement.png',
        contentType: 'image/png',
      });
    writeSpy.mockRestore();

    const after = await FinanceItem.findByPk(created.body.id);
    expect(response.status).toBe(500);
    expect(after.title).toBe('Stable item');
    expect(after.storedName).toBe(before.storedName);
    expect(after.fileName).toBe('stable.pdf');
    expect(fs.existsSync(oldPath)).toBe(true);
    expect(fs.readdirSync(process.env.FINANCE_UPLOAD_DIR).filter((name) => !filesBefore.has(name))).toEqual([]);

    const downloaded = await request(app)
      .get(`/projects/${project.id}/finance/${created.body.id}/file`)
      .set('Cookie', adminCookie)
      .buffer(true);
    expect(downloaded.status).toBe(200);
    expect(downloaded.body).toEqual(oldContents);
  });
});
