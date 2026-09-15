const { sequelize, Project, BoardColumn, TaskActivity, User, Task } = require('../../src/models');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');
const { backfillBoardColumns } = require('../../src/utils/backfillBoardColumns');

describe('backfillBoardColumns', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('seeds defaults for projects with no columns and is a no-op the second time', async () => {
    const project = await Project.create({ name: 'Legacy' });
    expect(await BoardColumn.count()).toBe(0);
    await backfillBoardColumns();
    const cols = await BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC']],
    });
    expect(cols.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
    const n = await BoardColumn.count();
    await backfillBoardColumns();
    expect(await BoardColumn.count()).toBe(n);
  });

  it('rewrites activity slugs to default labels even when columns already exist', async () => {
    const project = await Project.create({ name: 'Act' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const user = await User.create({
      name: 'A',
      email: 'a@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
    const task = await Task.create({ projectId: project.id, title: 'T', columnId: todoCol.id });
    const row = await TaskActivity.create({
      taskId: task.id,
      userId: user.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'todo',
    });
    await backfillBoardColumns();
    await row.reload();
    expect(row.toStatus).toBe('To Do');
  });
});
