const { sequelize, User, Project, Task, Note } = require('../../src/models');

describe('Note model', () => {
  let owner;
  let project;
  let task;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    owner = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
    project = await Project.create({ name: 'Website Revamp' });
    task = await Task.create({ projectId: project.id, title: 'Build homepage' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a standalone note owned by a user', async () => {
    const note = await Note.create({
      userId: owner.id,
      title: 'Remember to follow up',
      content: 'Call the client about scope',
    });
    expect(note.isReminder).toBe(false);
    expect(note.projectId).toBeNull();
  });

  it('creates a note linked to a project', async () => {
    const note = await Note.create({
      userId: owner.id,
      projectId: project.id,
      title: 'Project kickoff notes',
      content: 'Discussed timeline',
    });
    expect(note.projectId).toBe(project.id);
  });

  it('creates a reminder note linked to a task with remindAt', async () => {
    const remindAt = new Date(Date.now() + 60000);
    const note = await Note.create({
      userId: owner.id,
      taskId: task.id,
      title: 'Ping client',
      content: 'Send status update',
      isReminder: true,
      remindAt,
    });
    expect(note.isReminder).toBe(true);
    expect(note.notifiedAt).toBeNull();
  });

  it('rejects a note linked to both a project and a task', async () => {
    await expect(
      Note.create({
        userId: owner.id,
        projectId: project.id,
        taskId: task.id,
        title: 'Invalid',
        content: 'Cannot link both',
      })
    ).rejects.toThrow();
  });
});
