const { sequelize } = require('../models');

async function ensureTaskActivityTypes() {
  if (sequelize.getDialect() !== 'mysql') return;
  await sequelize.query(
    "ALTER TABLE TaskActivities MODIFY COLUMN type ENUM('created','status_changed','assignee_changed') NOT NULL"
  );
}

module.exports = { ensureTaskActivityTypes };
