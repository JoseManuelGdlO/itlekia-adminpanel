const { sequelize, Project, User, Task, BoardColumn } = require('../../src/models');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('Task model', () => {
  let project;
  let developer;
  let todoCol;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'Website Revamp' });
    developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
    [todoCol] = await seedDefaultColumns(project.id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a task linked to a column and project', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Build homepage',
      columnId: todoCol.id,
    });
    expect(task.columnId).toBe(todoCol.id);
    expect(task.status).toBeUndefined();
    const withProject = await Task.findByPk(task.id, { include: 'project' });
    expect(withProject.project.name).toBe('Website Revamp');
  });

  it('assigns a task to a user via the assignee association', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Fix nav bug',
      assigneeId: developer.id,
      columnId: todoCol.id,
    });
    const withAssignee = await Task.findByPk(task.id, { include: 'assignee' });
    expect(withAssignee.assignee.email).toBe('dev1@example.com');
  });
});
