process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, ProjectMember, Feature } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('features routes', () => {
  let adminCookie;
  let memberCookie;
  let outsiderCookie;
  let project;
  let admin;
  let member;
  let outsider;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    member = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    memberCookie = `token=${signToken({ id: member.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: member.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('admin creates and member can list; outsider and developer write are forbidden', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'SSO', description: 'Login', status: 'pending' });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('SSO');
    expect(created.body.userId).toBe(admin.id);

    const listed = await request(app).get(`/projects/${project.id}/features`).set('Cookie', memberCookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const denied = await request(app).get(`/projects/${project.id}/features`).set('Cookie', outsiderCookie);
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: 'Forbidden' });

    const write = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', memberCookie)
      .send({ title: 'Nope' });
    expect(write.status).toBe(403);
  });

  it('clearing isReminder nulls remindAt but keeps notifiedAt', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({
        title: 'Alerts',
        isReminder: true,
        remindAt: new Date().toISOString(),
      });
    const { Feature } = require('../../src/models');
    const row = await Feature.findByPk(created.body.id);
    row.notifiedAt = new Date();
    await row.save();

    const updated = await request(app)
      .put(`/projects/${project.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ isReminder: false });
    expect(updated.status).toBe(200);
    expect(updated.body.isReminder).toBe(false);
    expect(updated.body.remindAt).toBeNull();
    expect(updated.body.notifiedAt).not.toBeNull();
  });

  it('lists features by ascending id and uses create defaults', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'Default feature', remindAt: new Date().toISOString() });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('pending');
    expect(created.body.isReminder).toBe(false);
    expect(created.body.remindAt).toBeNull();

    const listed = await request(app).get(`/projects/${project.id}/features`).set('Cookie', adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.map((feature) => feature.id)).toEqual(
      [...listed.body.map((feature) => feature.id)].sort((a, b) => a - b),
    );
  });

  it('validates status on create and update', async () => {
    const invalidCreate = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'Invalid', status: 'started' });
    expect(invalidCreate.status).toBe(400);
    expect(invalidCreate.body).toEqual({ error: 'Invalid status' });

    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'Valid' });
    const invalidUpdate = await request(app)
      .put(`/projects/${project.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'started' });
    expect(invalidUpdate.status).toBe(400);
    expect(invalidUpdate.body).toEqual({ error: 'Invalid status' });
  });

  it('rejects missing, empty, and whitespace-only titles on create and update', async () => {
    for (const title of [undefined, '', '   ']) {
      const response = await request(app)
        .post(`/projects/${project.id}/features`)
        .set('Cookie', adminCookie)
        .send(title === undefined ? {} : { title });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid title' });
    }

    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'Valid' });
    const updated = await request(app)
      .put(`/projects/${project.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ title: '   ' });

    expect(updated.status).toBe(400);
    expect(updated.body).toEqual({ error: 'Invalid title' });
  });

  it('updates optional fields and deletes a project feature', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'Old title' });
    const remindAt = new Date().toISOString();
    const updated = await request(app)
      .put(`/projects/${project.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({
        title: 'New title',
        description: 'Details',
        status: 'done',
        isReminder: true,
        remindAt,
      });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      title: 'New title',
      description: 'Details',
      status: 'done',
      isReminder: true,
    });
    expect(updated.body.remindAt).not.toBeNull();

    const removed = await request(app)
      .delete(`/projects/${project.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie);
    expect(removed.status).toBe(204);

    const missing = await request(app)
      .delete(`/projects/${project.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Feature not found' });
  });

  it('returns exact not-found errors for missing projects and cross-project features', async () => {
    const missingProject = await request(app)
      .get('/projects/999999/features')
      .set('Cookie', adminCookie);
    expect(missingProject.status).toBe(404);
    expect(missingProject.body).toEqual({ error: 'Project not found' });

    const otherProject = await Project.create({ name: 'Other project' });
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'Scoped feature' });
    const wrongProject = await request(app)
      .put(`/projects/${otherProject.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ title: 'No access' });
    expect(wrongProject.status).toBe(404);
    expect(wrongProject.body).toEqual({ error: 'Feature not found' });
  });

  it('admin creates a reminder with extra notify users', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({
        title: 'Remind extras',
        isReminder: true,
        remindAt: new Date().toISOString(),
        notifyUserIds: [member.id],
      });
    expect(created.status).toBe(201);
    expect(created.body.notifyUsers[0].name).toBe('Dev');
  });

  it('rejects a reminder with a non-member recipient', async () => {
    const title = 'Invalid extra';
    const before = await Feature.count({ where: { title } });
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({
        title,
        isReminder: true,
        remindAt: new Date().toISOString(),
        notifyUserIds: [outsider.id],
      });
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: 'Invalid recipient' });
    expect(await Feature.count({ where: { title } })).toBe(before);
  });

  it('includes notifyUsers when listing features as a member', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({
        title: 'Listed extras',
        isReminder: true,
        remindAt: new Date().toISOString(),
        notifyUserIds: [member.id],
      });
    const listed = await request(app)
      .get(`/projects/${project.id}/features`)
      .set('Cookie', memberCookie);
    expect(listed.status).toBe(200);
    const found = listed.body.find((feature) => feature.id === created.body.id);
    expect(found.notifyUsers).toEqual([{ id: member.id, name: 'Dev' }]);
  });
});
