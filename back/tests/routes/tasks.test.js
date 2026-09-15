process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const {
  sequelize,
  User,
  Project,
  ProjectMember,
  Task,
  TaskActivity,
  BoardColumn,
} = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('tasks routes', () => {
  let adminCookie;
  let developerCookie;
  let otherDeveloperCookie;
  let developer;
  let otherDeveloper;
  let project;
  let assignedTask;
  let todoCol;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    otherDeveloper = await User.create({ name: 'Dev2', email: 'dev2@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    otherDeveloperCookie = `token=${signToken({ id: otherDeveloper.id, role: 'developer' })}`;

    project = await Project.create({ name: 'Website Revamp' });
    [todoCol] = await seedDefaultColumns(project.id);
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    assignedTask = await Task.create({
      projectId: project.id,
      title: 'Build homepage',
      assigneeId: developer.id,
      columnId: todoCol.id,
    });
    await Task.create({
      projectId: project.id,
      title: 'Not assigned to dev',
      columnId: todoCol.id,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('developer member listing tasks sees all tasks on the project', async () => {
    const res = await request(app)
      .get(`/tasks?projectId=${project.id}`)
      .set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('developer with no memberships gets an empty task list without projectId', async () => {
    const memberless = await User.create({
      name: 'Memberless',
      email: 'memberless@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const cookie = `token=${signToken({ id: memberless.id, role: 'developer' })}`;

    const res = await request(app).get('/tasks').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('developer without projectId sees every task in member projects', async () => {
    const res = await request(app).get('/tasks').set('Cookie', developerCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((task) => task.title)).toEqual([
      'Build homepage',
      'Not assigned to dev',
    ]);
  });

  it('developer who is not a member gets 403 when filtering by projectId', async () => {
    const res = await request(app)
      .get(`/tasks?projectId=${project.id}`)
      .set('Cookie', otherDeveloperCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('admin creates a task', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'New task' });
    expect(res.status).toBe(201);
  });

  it('creates a task in a provided project column', async () => {
    const cols = await BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC']],
    });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Start in progress', columnId: cols[1].id });

    expect(res.status).toBe(201);
    expect(res.body.columnId).toBe(cols[1].id);
  });

  it('rejects a provided create column from another project', async () => {
    const other = await Project.create({ name: 'Foreign create board' });
    const [foreignCol] = await seedDefaultColumns(other.id);
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Wrong board', columnId: foreignCol.id });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid column' });
  });

  it('rolls back task creation and returns JSON 500 when activity creation fails', async () => {
    const activitySpy = jest
      .spyOn(TaskActivity, 'create')
      .mockRejectedValueOnce(new Error('activity insert failed'));

    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Must roll back' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(await Task.findOne({ where: { title: 'Must roll back' } })).toBeNull();
    activitySpy.mockRestore();
  });

  it('developer member creates a task assigned to another member', async () => {
    await ProjectMember.create({ projectId: project.id, userId: otherDeveloper.id });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: project.id, title: 'Pair work', assigneeId: otherDeveloper.id });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Pair work');
    const activities = await TaskActivity.findAll({ where: { taskId: res.body.id } });
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('created');
    expect(activities[0].toStatus).toBe('To Do');
  });

  it('developer cannot create a task on a project they do not belong to', async () => {
    const foreign = await Project.create({ name: 'Secret' });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: foreign.id, title: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('developer cannot assign a non-member', async () => {
    const stranger = await User.create({
      name: 'Stranger',
      email: 'stranger@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: project.id, title: 'Nope', assigneeId: stranger.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Assignee must be a project member' });
  });

  it('assignee can PATCH the column of their task', async () => {
    const cols = await BoardColumn.findAll({ where: { projectId: project.id }, order: [['position', 'ASC']] });
    const inProgress = cols[1];
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/column`)
      .set('Cookie', developerCookie)
      .send({ columnId: inProgress.id });
    expect(res.status).toBe(200);
    expect(res.body.columnId).toBe(inProgress.id);
  });

  it('a different developer cannot PATCH the column of a task not assigned to them', async () => {
    const cols = await BoardColumn.findAll({ where: { projectId: project.id } });
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/column`)
      .set('Cookie', otherDeveloperCookie)
      .send({ columnId: cols[2].id });
    expect(res.status).toBe(403);
  });

  it('rejects a column from another project', async () => {
    const other = await Project.create({ name: 'Other board' });
    const [foreignCol] = await seedDefaultColumns(other.id);
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/column`)
      .set('Cookie', adminCookie)
      .send({ columnId: foreignCol.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid column' });
  });

  it('rejects a missing column', async () => {
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/column`)
      .set('Cookie', adminCookie)
      .send({ columnId: 999999 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid column' });
  });

  it('does not expose PATCH /tasks/:id/status', async () => {
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'done' });
    expect(res.status).toBe(404);
  });

  it('a different developer cannot PUT a task not assigned to them', async () => {
    const res = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', otherDeveloperCookie)
      .send({ description: 'Trying to sneak in an update' });
    expect(res.status).toBe(403);
  });

  it('assignee PUT only applies the description field, ignoring others', async () => {
    const res = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', developerCookie)
      .send({ description: 'Updated details', title: 'Hijacked title' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated details');
    expect(res.body.title).toBe('Build homepage');
  });

  it("admin moving a task to another project resets it to that project's first column", async () => {
    const destination = await Project.create({ name: 'Destination project' });
    const [destinationFirstColumn] = await seedDefaultColumns(destination.id);
    const task = await Task.create({
      projectId: project.id,
      title: 'Move me',
      columnId: todoCol.id,
    });

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Cookie', adminCookie)
      .send({ projectId: destination.id });

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(destination.id);
    expect(res.body.columnId).toBe(destinationFirstColumn.id);
    const column = await BoardColumn.findByPk(res.body.columnId);
    expect(column.projectId).toBe(destination.id);
  });

  it('admin deletes a task', async () => {
    const toDelete = await Task.create({
      projectId: project.id,
      title: 'Temp',
      columnId: todoCol.id,
    });
    const res = await request(app).delete(`/tasks/${toDelete.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });
});
