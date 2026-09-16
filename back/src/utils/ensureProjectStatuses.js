const { sequelize } = require('../models');

async function ensureProjectStatuses() {
  if (sequelize.getDialect() !== 'mysql') return;
  await sequelize.query(
    "ALTER TABLE Projects MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'trabajando'"
  );
  await sequelize.query("UPDATE Projects SET status = 'trabajando' WHERE status = 'active'");
  await sequelize.query("UPDATE Projects SET status = 'archivado' WHERE status = 'archived'");
  await sequelize.query(
    "ALTER TABLE Projects MODIFY COLUMN status ENUM('trabajando','parado','oculto','archivado') NOT NULL DEFAULT 'trabajando'"
  );
}

module.exports = { ensureProjectStatuses };
