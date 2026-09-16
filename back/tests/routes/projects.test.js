process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const financeFiles = require('../../src/utils/financeFiles');

const removeFinanceFileSpy = jest.spyOn(financeFiles, 'removeFinanceFile').mockImplementation(() => {});

const app = require('../../src/app');
const {
  sequelize,
  User,
  Project,
  Task,
  Note,
  ProjectMember,
  TaskActivity,
  FinanceItem,
  Feature,
  BoardColumn,
  NoteNotify,
  FeatureNotify,
} = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('projects routes', () => {
  let adminCookie;
  let developerCookie;
  let memberProject;
  let otherProject;
  let developer;

  beforeEach(() => {
    removeFinanceFileSpy.mockClear();
  });

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

  it('hides oculto and archivado projects from a member developer', async () => {
    const hidden = await Project.create({ name: 'Ghost', status: 'oculto' });
    const parked = await Project.create({ name: 'Shelf', status: 'archivado' });
    await ProjectMember.create({ projectId: hidden.id, userId: developer.id });
    await ProjectMember.create({ projectId: parked.id, userId: developer.id });
    const res = await request(app).get('/projects').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    const names = res.body.map((p) => p.name);
    expect(names).not.toContain('Ghost');
    expect(names).not.toContain('Shelf');
    expect(names).toContain('Assigned Project');
  });

  it('admin creates a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'New Project', description: 'desc' });
    expect(res.status).toBe(201);
  });

  it('admin create returns trabajando', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'Fresh' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('trabajando');
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

  it('rejects an invalid project status', async () => {
    const res = await request(app)
      .put(`/projects/${memberProject.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'active' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid status' });
  });

  it('admin updates and deletes a project', async () => {
    const putRes = await request(app)
      .put(`/projects/${otherProject.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'archivado' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe('archivado');

    const deleteRes = await request(app).delete(`/projects/${otherProject.id}`).set('Cookie', adminCookie);
    expect(deleteRes.status).toBe(204);
  });

  it('deletes a project and its dependent records', async () => {
    await sequelize.query('PRAGMA foreign_keys = ON');
    const commitSpy = jest.fn();
    const originalTransaction = sequelize.transaction.bind(sequelize);
    const transactionSpy = jest.spyOn(sequelize, 'transaction').mockImplementation(async (...args) => {
      const transaction = await originalTransaction(...args);
      const originalCommit = transaction.commit.bind(transaction);
      transaction.commit = jest.fn(async (...commitArgs) => {
        commitSpy();
        return originalCommit(...commitArgs);
      });
      return transaction;
    });

    try {
      const doomed = await Project.create({ name: 'Doomed board' });
      const [col] = await seedDefaultColumns(doomed.id);
      await ProjectMember.create({ projectId: doomed.id, userId: developer.id });
      const task = await Task.create({
        projectId: doomed.id,
        title: 'Goes with the project',
        columnId: col.id,
      });
      const projectNote = await Note.create({
        projectId: doomed.id,
        title: 'Project note',
        content: 'Delete with project',
        userId: developer.id,
      });
      const taskNote = await Note.create({
        taskId: task.id,
        title: 'Task note',
        content: 'Delete with task',
        userId: developer.id,
      });
      const standaloneNote = await Note.create({
        title: 'Standalone note',
        content: 'Keep this note',
        userId: developer.id,
      });
      await NoteNotify.create({ noteId: projectNote.id, userId: developer.id });
      await NoteNotify.create({ noteId: taskNote.id, userId: developer.id });
      await TaskActivity.create({ taskId: task.id, userId: developer.id, type: 'created' });
      const feature = await Feature.create({
        projectId: doomed.id,
        userId: developer.id,
        title: 'Feature request',
      });
      await FeatureNotify.create({ featureId: feature.id, userId: developer.id });
      await FinanceItem.create({
        projectId: doomed.id,
        kind: 'cost',
        title: 'Hosting',
        amount: 10,
        storedName: 'doomed-receipt.pdf',
        createdBy: developer.id,
      });

      const res = await request(app).delete(`/projects/${doomed.id}`).set('Cookie', adminCookie);

      expect(res.status).toBe(204);
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(removeFinanceFileSpy).toHaveBeenCalledWith('doomed-receipt.pdf');
      expect(commitSpy.mock.invocationCallOrder[0]).toBeLessThan(removeFinanceFileSpy.mock.invocationCallOrder[0]);
      expect(await ProjectMember.count({ where: { projectId: doomed.id } })).toBe(0);
      expect(await FinanceItem.count({ where: { projectId: doomed.id } })).toBe(0);
      expect(await Feature.count({ where: { projectId: doomed.id } })).toBe(0);
      expect(await FeatureNotify.count({ where: { featureId: feature.id } })).toBe(0);
      expect(await Note.count({ where: { projectId: doomed.id } })).toBe(0);
      expect(await Note.count({ where: { taskId: task.id } })).toBe(0);
      expect(await NoteNotify.count({ where: { noteId: [projectNote.id, taskNote.id] } })).toBe(0);
      expect(await TaskActivity.count({ where: { taskId: task.id } })).toBe(0);
      expect(await Task.count({ where: { projectId: doomed.id } })).toBe(0);
      expect(await BoardColumn.count({ where: { projectId: doomed.id } })).toBe(0);
      expect(await Project.count({ where: { id: doomed.id } })).toBe(0);
      expect(await Note.findByPk(standaloneNote.id)).not.toBeNull();
    } finally {
      transactionSpy.mockRestore();
      await sequelize.query('PRAGMA foreign_keys = OFF');
    }
  });
});
