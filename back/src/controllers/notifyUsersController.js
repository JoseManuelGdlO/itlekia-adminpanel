const { User } = require('../models');

async function list(req, res) {
  const users = await User.findAll({ order: [['id', 'ASC']] });
  return res.json(
    users.filter((u) => u.id !== req.user.id).map((u) => ({ id: u.id, name: u.name }))
  );
}

module.exports = { list };
