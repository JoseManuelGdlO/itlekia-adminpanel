const { sequelize, User, Project, FinanceItem } = require('../../src/models');

describe('FinanceItem model', () => {
  let project;
  let admin;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'Website Revamp' });
    admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a cost line linked to a project', async () => {
    const item = await FinanceItem.create({
      projectId: project.id,
      kind: 'cost',
      title: 'Hosting',
      amount: 49.99,
      notes: 'Yearly',
      createdBy: admin.id,
    });
    expect(item.kind).toBe('cost');
    expect(Number(item.amount)).toBe(49.99);
    expect(item.storedName).toBeNull();
    const withProject = await FinanceItem.findByPk(item.id, { include: ['project', 'creator'] });
    expect(withProject.project.name).toBe('Website Revamp');
    expect(withProject.creator.email).toBe('admin@example.com');
  });

  it('rejects an invalid kind', async () => {
    await expect(
      FinanceItem.create({
        projectId: project.id,
        kind: 'invoice',
        title: 'Bad',
        amount: 1,
        createdBy: admin.id,
      })
    ).rejects.toThrow();
  });

  it('rejects a negative amount', async () => {
    await expect(
      FinanceItem.create({
        projectId: project.id,
        kind: 'cost',
        title: 'Bad',
        amount: -1,
        createdBy: admin.id,
      })
    ).rejects.toThrow();
  });
});
