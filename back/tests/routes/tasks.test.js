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
  Note,
  NoteNotify,
} = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');
const mailer = require('../../src/utils/mailer');
const { __flushAssignmentEmails } = require('../../src/controllers/tasksController');

function neverResolvingMail() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

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

  // Assignment emails are fire-and-forget, so drain them before the next test spies on the mailer.
  afterEach(async () => {
    await __flushAssignmentEmails();
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

  it('rejects creating a task on a paused project', async () => {
    const paused = await Project.create({ name: 'Paused', status: 'parado' });
    await seedDefaultColumns(paused.id);

    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: paused.id, title: 'Nope' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Project is paused' });
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

  it('emails the assignee on create and not when unassigned', async () => {
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockResolvedValue();
    const assigned = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Paged', assigneeId: developer.id });
    expect(assigned.status).toBe(201);
    await __flushAssignmentEmails();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].to).toBe('dev@example.com');
    spy.mockClear();
    const open = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Unassigned' });
    expect(open.status).toBe(201);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emails only when PUT changes the assignee', async () => {
    await ProjectMember.findOrCreate({
      where: { projectId: project.id, userId: otherDeveloper.id },
    });
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockResolvedValue();
    const same = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', adminCookie)
      .send({ assigneeId: developer.id });
    expect(same.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
    const changed = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', adminCookie)
      .send({ assigneeId: otherDeveloper.id });
    expect(changed.status).toBe(200);
    await __flushAssignmentEmails();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].to).toBe('dev2@example.com');
    await Task.update(
      { assigneeId: developer.id },
      { where: { id: assignedTask.id } }
    );
    spy.mockRestore();
  });

  it('still creates the task when assignment email throws', async () => {
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockRejectedValue(new Error('smtp down'));
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Mail fail', assigneeId: developer.id });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Mail fail');
    await __flushAssignmentEmails();
    spy.mockRestore();
  });

  it('answers POST /tasks without waiting for the assignment email', async () => {
    const pending = neverResolvingMail();
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockReturnValue(pending.promise);

    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Slow mail create', assigneeId: developer.id });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Slow mail create');
    pending.release();
    await __flushAssignmentEmails();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('answers an assignee-changing PUT /tasks/:id without waiting for the assignment email', async () => {
    await ProjectMember.findOrCreate({
      where: { projectId: project.id, userId: otherDeveloper.id },
    });
    const task = await Task.create({
      projectId: project.id,
      title: 'Slow mail update',
      assigneeId: developer.id,
      columnId: todoCol.id,
    });
    const pending = neverResolvingMail();
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockReturnValue(pending.promise);

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Cookie', adminCookie)
      .send({ assigneeId: otherDeveloper.id });

    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(otherDeveloper.id);
    pending.release();
    await __flushAssignmentEmails();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
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
    expect(res.body).toEqual({ error: 'Invalid assignee' });
  });

  it('admin cannot assign a non-member', async () => {
    const stranger = await User.create({
      name: 'Outsider',
      email: 'outsider@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Nope', assigneeId: stranger.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid assignee' });
  });

  it('strips script tags from description and keeps strong', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({
        projectId: project.id,
        title: 'Rich',
        description: '<p>Hi <strong>there</strong><script>alert(1)</script></p>',
      });
    expect(res.status).toBe(201);
    expect(res.body.description).toContain('<strong>there</strong>');
    expect(res.body.description).not.toContain('script');
  });

  it('stores blank html description as null', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Empty html', description: '<p></p>' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
  });

  it('rejects an oversized description', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({
        projectId: project.id,
        title: 'Too big',
        description: `<p>${'a'.repeat(20001)}</p>`,
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid description' });
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

  it('rejects moving a task on a paused project', async () => {
    const paused = await Project.create({ name: 'Paused move', status: 'trabajando' });
    const cols = await seedDefaultColumns(paused.id);
    const task = await Task.create({
      projectId: paused.id,
      title: 'Stay put',
      columnId: cols[0].id,
    });
    await request(app)
      .put(`/projects/${paused.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'parado' });

    const res = await request(app)
      .patch(`/tasks/${task.id}/column`)
      .set('Cookie', adminCookie)
      .send({ columnId: cols[1].id });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Project is paused' });
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

  it('admin PUT rejects an assignee who is not a project member', async () => {
    const outsider = await User.create({
      name: 'PUT outsider',
      email: 'put-outsider@example.com',
      passwordHash: 'x',
      role: 'developer',
    });

    const res = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', adminCookie)
      .send({ assigneeId: outsider.id });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid assignee' });
  });

  it('admin PUT sanitizes scripts and stores blank HTML descriptions as null', async () => {
    const scripted = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', adminCookie)
      .send({ description: '<p>Keep <strong>this</strong><script>alert(1)</script></p>' });

    expect(scripted.status).toBe(200);
    expect(scripted.body.description).toContain('<strong>this</strong>');
    expect(scripted.body.description).not.toContain('script');

    const blank = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', adminCookie)
      .send({ description: '<p></p>' });

    expect(blank.status).toBe(200);
    expect(blank.body.description).toBeNull();
  });

  it('does not reset columnId when PUT projectId is the current project as a string', async () => {
    const cols = await BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC']],
    });
    const inProgress = cols[1];
    const task = await Task.create({
      projectId: project.id,
      title: 'Stay in progress',
      columnId: inProgress.id,
    });

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Cookie', adminCookie)
      .send({ projectId: String(task.projectId), title: 'Renamed in place' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Renamed in place');
    expect(res.body.projectId).toBe(project.id);
    expect(res.body.columnId).toBe(inProgress.id);
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

  it('admin PUT rejects moving a task when its assignee is not a destination member', async () => {
    const destination = await Project.create({ name: 'Destination without assignee' });
    await seedDefaultColumns(destination.id);
    const task = await Task.create({
      projectId: project.id,
      title: 'Keep valid assignee',
      assigneeId: developer.id,
      columnId: todoCol.id,
    });

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .set('Cookie', adminCookie)
      .send({ projectId: destination.id });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid assignee' });
    await task.reload();
    expect(task.projectId).toBe(project.id);
    expect(task.assigneeId).toBe(developer.id);
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

  it('admin delete cascades notes, notifies, and activity and keeps sibling project notes', async () => {
    await sequelize.query('PRAGMA foreign_keys = ON');
    try {
      const doomed = await Task.create({
        projectId: project.id,
        title: 'Doomed task',
        columnId: todoCol.id,
      });
      const taskNote = await Note.create({
        taskId: doomed.id,
        title: 'Task note',
        content: 'Delete with task',
        userId: developer.id,
      });
      const sibling = await Note.create({
        projectId: project.id,
        title: 'Project note',
        content: 'Keep this note',
        userId: developer.id,
      });
      await NoteNotify.create({ noteId: taskNote.id, userId: developer.id });
      await NoteNotify.create({ noteId: sibling.id, userId: developer.id });
      await TaskActivity.create({ taskId: doomed.id, userId: developer.id, type: 'created' });

      const res = await request(app).delete(`/tasks/${doomed.id}`).set('Cookie', adminCookie);

      expect(res.status).toBe(204);
      expect(await Task.findByPk(doomed.id)).toBeNull();
      expect(await Note.findByPk(taskNote.id)).toBeNull();
      expect(await NoteNotify.count({ where: { noteId: taskNote.id } })).toBe(0);
      expect(await TaskActivity.count({ where: { taskId: doomed.id } })).toBe(0);
      expect(await Note.findByPk(sibling.id)).not.toBeNull();
      expect(await NoteNotify.count({ where: { noteId: sibling.id } })).toBe(1);
    } finally {
      await sequelize.query('PRAGMA foreign_keys = OFF');
    }
  });

  it('developer cannot delete a task', async () => {
    const blocked = await Task.create({
      projectId: project.id,
      title: 'Stay',
      columnId: todoCol.id,
    });
    const res = await request(app).delete(`/tasks/${blocked.id}`).set('Cookie', developerCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    expect(await Task.findByPk(blocked.id)).not.toBeNull();
  });

  it('unknown task delete returns 404', async () => {
    const res = await request(app).delete('/tasks/99999').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Task not found' });
  });

  it('admin can delete a task on a paused project', async () => {
    const paused = await Project.create({ name: 'Paused board', status: 'parado' });
    const [col] = await seedDefaultColumns(paused.id);
    const pausedTask = await Task.create({
      projectId: paused.id,
      title: 'Paused task',
      columnId: col.id,
    });
    const res = await request(app).delete(`/tasks/${pausedTask.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
    expect(await Task.findByPk(pausedTask.id)).toBeNull();
  });
});
