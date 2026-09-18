const { sequelize } = require('../models');

const COLUMNS = [
  { name: 'costAmount', sql: 'DECIMAL(12,2) NULL' },
  { name: 'contractSignedAt', sql: 'DATE NULL' },
  { name: 'monthlyAmount', sql: 'DECIMAL(12,2) NULL' },
  { name: 'monthlyPayDay', sql: 'INT NULL' },
];

async function ensureProjectFinance() {
  if (sequelize.getDialect() !== 'mysql') return;
  for (const column of COLUMNS) {
    const [rows] = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Projects' AND COLUMN_NAME = '${column.name}'`
    );
    if (rows.length) continue;
    await sequelize.query(`ALTER TABLE Projects ADD COLUMN ${column.name} ${column.sql}`);
  }
}

module.exports = { ensureProjectFinance };
