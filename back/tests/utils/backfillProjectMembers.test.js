const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { backfillProjectMembers } = require('../../src/utils/backfillProjectMembers');

describe('backfillProjectMembers', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates members from distinct task assignees and is idempotent', async () => {
    const project = await Project.create({ name: 'A' });
    const dev = await User.create({
      name: 'Dev',
      email: 'dev@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await Task.create({ projectId: project.id, title: 'One', assigneeId: dev.id });
    await Task.create({ projectId: project.id, title: 'Two', assigneeId: dev.id });
    await Task.create({ projectId: project.id, title: 'Unassigned' });

    await backfillProjectMembers();
    await backfillProjectMembers();

    const rows = await ProjectMember.findAll({ where: { projectId: project.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(dev.id);
  });
});
