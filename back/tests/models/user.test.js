const { sequelize, User } = require('../../src/models');

describe('User model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a user with a valid role', async () => {
    const user = await User.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      passwordHash: 'hashed',
      role: 'admin',
    });
    expect(user.id).toBeDefined();
    expect(user.role).toBe('admin');
  });

  it('rejects an invalid role', async () => {
    await expect(
      User.create({
        name: 'Bad Role',
        email: 'bad@example.com',
        passwordHash: 'hashed',
        role: 'manager',
      })
    ).rejects.toThrow();
  });

  it('rejects a duplicate email', async () => {
    await User.create({
      name: 'First',
      email: 'dup@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
    await expect(
      User.create({
        name: 'Second',
        email: 'dup@example.com',
        passwordHash: 'hashed',
        role: 'developer',
      })
    ).rejects.toThrow();
  });
});
