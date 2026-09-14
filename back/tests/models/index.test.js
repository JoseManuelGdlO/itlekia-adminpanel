const { sequelize } = require('../../src/models');

describe('database connection', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('authenticates successfully', async () => {
    await expect(sequelize.authenticate()).resolves.not.toThrow();
  });
});
