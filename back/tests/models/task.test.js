const { sequelize, Project, User, Task } = require('../../src/models');

describe('Task model', () => {
  let project;
  let developer;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'Website Revamp' });
    developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a task defaulting to todo status, linked to a project', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Build homepage',
    });
    expect(task.status).toBe('todo');
    const withProject = await Task.findByPk(task.id, { include: 'project' });
    expect(withProject.project.name).toBe('Website Revamp');
  });

  it('assigns a task to a user via the assignee association', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Fix nav bug',
      assigneeId: developer.id,
    });
    const withAssignee = await Task.findByPk(task.id, { include: 'assignee' });
    expect(withAssignee.assignee.email).toBe('dev1@example.com');
  });

  it('rejects an invalid status', async () => {
    await expect(
      Task.create({ projectId: project.id, title: 'Bad', status: 'archived' })
    ).rejects.toThrow();
  });
});
