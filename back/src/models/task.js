const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    columnId: { type: DataTypes.INTEGER, allowNull: false },
    dueDate: { type: DataTypes.DATE, allowNull: true },
  });

  return Task;
};
