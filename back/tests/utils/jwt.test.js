process.env.JWT_SECRET = 'test-secret';
const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('jwt utils', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken({ id: 1, role: 'admin' });
    const payload = verifyToken(token);
    expect(payload.id).toBe(1);
    expect(payload.role).toBe('admin');
  });

  it('throws on a tampered token', () => {
    const token = signToken({ id: 1, role: 'admin' });
    expect(() => verifyToken(token + 'x')).toThrow();
  });
});
