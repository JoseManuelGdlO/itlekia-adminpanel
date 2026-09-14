const { sequelize, Project } = require('../../src/models');

describe('Project model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a project defaulting to active status', async () => {
    const project = await Project.create({
      name: 'Website Revamp',
      description: 'Redesign the marketing site',
    });
    expect(project.status).toBe('active');
  });

  it('rejects an invalid status', async () => {
    await expect(
      Project.create({ name: 'Bad', status: 'paused' })
    ).rejects.toThrow();
  });
});
