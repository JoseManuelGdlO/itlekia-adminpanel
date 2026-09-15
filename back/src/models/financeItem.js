const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FinanceItem = sequelize.define(
    'FinanceItem',
    {
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      kind: {
        type: DataTypes.ENUM('cost', 'contract', 'budget'),
        allowNull: false,
        validate: {
          isIn: { args: [['cost', 'contract', 'budget']], msg: 'Invalid kind' },
        },
      },
      title: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      fileName: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      storedName: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      mimeType: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      createdBy: { type: DataTypes.INTEGER, allowNull: false },
    }
  );
  return FinanceItem;
};
