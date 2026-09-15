const { sequelize, User, Project, Feature } = require('../../src/models');

describe('Feature model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('defaults status to pending', async () => {
    const project = await Project.create({ name: 'A' });
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
    const feature = await Feature.create({
      projectId: project.id,
      userId: admin.id,
      title: 'SSO',
    });
    expect(feature.status).toBe('pending');
    expect(feature.isReminder).toBe(false);
    const loaded = await Feature.findByPk(feature.id, { include: ['creator'] });
    expect(loaded.creator.email).toBe('admin@example.com');
  });

  it('rejects an invalid status', async () => {
    const project = await Project.create({ name: 'B' });
    const admin = await User.create({
      name: 'A2',
      email: 'a2@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
    await expect(
      Feature.create({
        projectId: project.id,
        userId: admin.id,
        title: 'Bad',
        status: 'shipped',
      })
    ).rejects.toThrow();
  });
});
