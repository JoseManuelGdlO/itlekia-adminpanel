require('dotenv').config();
const { sequelize, User } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

async function main() {
  await sequelize.sync();

  const existingAdmin = await User.findOne({ where: { role: 'admin' } });
  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.email}`);
    process.exit(0);
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@portal-admin-intk.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'change-me-now';

  await User.create({
    name: 'Admin',
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
  });

  console.log(`Created admin user: ${email} / ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
