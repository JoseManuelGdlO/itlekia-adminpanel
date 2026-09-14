const { User } = require('../models');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function setTokenCookie(res, user) {
  const token = signToken({ id: user.id, role: user.role });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  setTokenCookie(res, user);
  return res.json(toPublicUser(user));
}

async function logout(req, res) {
  res.clearCookie('token');
  return res.status(204).send();
}

async function me(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json(toPublicUser(user));
}

module.exports = { login, logout, me, toPublicUser };
