const { sequelize } = require('../models');

async function ensureTaskEstimatedHours() {
  if (sequelize.getDialect() !== 'mysql') return;
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'estimatedHours'`
  );
  if (rows.length) return;
  await sequelize.query('ALTER TABLE Tasks ADD COLUMN estimatedHours DECIMAL(10,2) NULL');
}

module.exports = { ensureTaskEstimatedHours };
