const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    columnId: { type: DataTypes.INTEGER, allowNull: false },
    dueDate: { type: DataTypes.DATE, allowNull: true },
    estimatedHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: null },
    assigneeConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  });

  return Task;
};
