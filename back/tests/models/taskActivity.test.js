const { sequelize, User, Project, Task, TaskActivity } = require('../../src/models');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('TaskActivity model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('records a created event with toStatus todo', async () => {
    const project = await Project.create({ name: 'A' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const user = await User.create({
      name: 'Dev',
      email: 'dev@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const task = await Task.create({ projectId: project.id, title: 'T', columnId: todoCol.id });
    const row = await TaskActivity.create({
      taskId: task.id,
      userId: user.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'todo',
    });
    expect(row.type).toBe('created');
    expect(row.fromStatus).toBeNull();
    expect(row.toStatus).toBe('todo');
    const withUser = await TaskActivity.findByPk(row.id, { include: ['user'] });
    expect(withUser.user.name).toBe('Dev');
  });

  it('rejects an invalid type', async () => {
    const project = await Project.create({ name: 'B' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const user = await User.create({
      name: 'Dev2',
      email: 'dev2@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const task = await Task.create({ projectId: project.id, title: 'T2', columnId: todoCol.id });
    await expect(
      TaskActivity.create({
        taskId: task.id,
        userId: user.id,
        type: 'renamed',
        toStatus: 'todo',
      })
    ).rejects.toThrow();
  });
});
