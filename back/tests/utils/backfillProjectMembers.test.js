const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { backfillProjectMembers } = require('../../src/utils/backfillProjectMembers');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('backfillProjectMembers', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates members from distinct task assignees and is idempotent', async () => {
    const project = await Project.create({ name: 'A' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const dev = await User.create({
      name: 'Dev',
      email: 'dev@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await Task.create({ projectId: project.id, title: 'One', assigneeId: dev.id, columnId: todoCol.id });
    await Task.create({ projectId: project.id, title: 'Two', assigneeId: dev.id, columnId: todoCol.id });
    await Task.create({ projectId: project.id, title: 'Unassigned', columnId: todoCol.id });

    await backfillProjectMembers();
    await backfillProjectMembers();

    const rows = await ProjectMember.findAll({ where: { projectId: project.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(dev.id);
  });

  it('does not recreate a removed membership after the initial backfill', async () => {
    const project = await Project.create({ name: 'B' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const dev = await User.create({
      name: 'Removed Dev',
      email: 'removed@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await Task.create({
      projectId: project.id,
      title: 'Keep task',
      assigneeId: dev.id,
      columnId: todoCol.id,
    });

    await backfillProjectMembers();
    const membership = await ProjectMember.findOne({
      where: { projectId: project.id, userId: dev.id },
    });
    expect(membership).not.toBeNull();

    const keeperProject = await Project.create({ name: 'Existing membership' });
    const keeper = await User.create({
      name: 'Keeper',
      email: 'keeper@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await ProjectMember.create({ projectId: keeperProject.id, userId: keeper.id });

    await membership.destroy();
    await backfillProjectMembers();

    expect(
      await ProjectMember.findOne({ where: { projectId: project.id, userId: dev.id } })
    ).toBeNull();
  });
});
