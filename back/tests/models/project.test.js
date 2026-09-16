process.env.JWT_SECRET = 'test-secret';
const { sequelize, Project } = require('../../src/models');

describe('Project status', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });
  afterAll(async () => {
    await sequelize.close();
  });

  it('defaults to trabajando', async () => {
    const p = await Project.create({ name: 'N' });
    expect(p.status).toBe('trabajando');
  });

  it('rejects an unknown status', async () => {
    await expect(Project.create({ name: 'N', status: 'active' })).rejects.toThrow();
  });
});
