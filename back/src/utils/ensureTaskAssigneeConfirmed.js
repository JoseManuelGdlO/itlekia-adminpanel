const { sequelize } = require('../models');

async function ensureTaskAssigneeConfirmed() {
  if (sequelize.getDialect() !== 'mysql') return;
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'assigneeConfirmed'`
  );
  if (rows.length) return;
  await sequelize.query(
    'ALTER TABLE Tasks ADD COLUMN assigneeConfirmed TINYINT(1) NOT NULL DEFAULT 1'
  );
}

module.exports = { ensureTaskAssigneeConfirmed };
