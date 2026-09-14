const { User } = require('../models');
const { hashPassword } = require('../utils/password');
const { toPublicUser } = require('./authController');

async function list(req, res) {
  const users = await User.findAll({ order: [['id', 'ASC']] });
  return res.json(users.map(toPublicUser));
}

async function create(req, res) {
  const { name, email, password, role } = req.body;
  const user = await User.create({
    name,
    email,
    role,
    passwordHash: await hashPassword(password),
  });
  return res.status(201).json(toPublicUser(user));
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { name, email, role, password } = req.body;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (password) user.passwordHash = await hashPassword(password);
  await user.save();
  return res.json(toPublicUser(user));
}

async function remove(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  await user.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
