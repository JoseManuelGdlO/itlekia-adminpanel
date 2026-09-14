const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('password utils', () => {
  it('hashes a password and verifies it matches', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash).not.toBe('correct-horse');
    await expect(comparePassword('correct-horse', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct-horse');
    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false);
  });
});
