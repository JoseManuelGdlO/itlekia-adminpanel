const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('todo', 'in_progress', 'review', 'done'),
      allowNull: false,
      defaultValue: 'todo',
      validate: {
        isIn: {
          args: [['todo', 'in_progress', 'review', 'done']],
          msg: 'Status must be one of: todo, in_progress, review, done',
        },
      },
    },
    dueDate: { type: DataTypes.DATE, allowNull: true },
  });

  return Task;
};
