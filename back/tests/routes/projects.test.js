process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember, BoardColumn } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('projects routes', () => {
  let adminCookie;
  let developerCookie;
  let memberProject;
  let otherProject;
  let developer;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;

    memberProject = await Project.create({ name: 'Assigned Project' });
    otherProject = await Project.create({ name: 'Other Project' });
    await ProjectMember.create({ projectId: memberProject.id, userId: developer.id });
    const [todoCol] = await seedDefaultColumns(otherProject.id);
    await Task.create({
      projectId: otherProject.id,
      title: 'Orphan task',
      assigneeId: developer.id,
      columnId: todoCol.id,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('admin sees all projects', async () => {
    const res = await request(app).get('/projects').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('developer only sees projects they are a member of', async () => {
    const res = await request(app).get('/projects').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Assigned Project');
  });

  it('developer with a task but no membership does not see that project', async () => {
    const res = await request(app).get('/projects').set('Cookie', developerCookie);
    expect(res.body.map((p) => p.name)).not.toContain('Other Project');
  });

  it('admin creates a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'New Project', description: 'desc' });
    expect(res.status).toBe(201);
  });

  it('admin create seeds To Do, In Progress, Review, Done', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'Boarded', description: 'x' });
    expect(res.status).toBe(201);
    const cols = await BoardColumn.findAll({
      where: { projectId: res.body.id },
      order: [['position', 'ASC']],
    });
    expect(cols.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
  });

  it('developer cannot create a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', developerCookie)
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('admin updates and deletes a project', async () => {
    const putRes = await request(app)
      .put(`/projects/${otherProject.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'archived' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe('archived');

    const deleteRes = await request(app).delete(`/projects/${otherProject.id}`).set('Cookie', adminCookie);
    expect(deleteRes.status).toBe(204);
  });
});
