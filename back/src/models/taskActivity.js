const { DataTypes } = require('sequelize');

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

module.exports = (sequelize) => {
  const TaskActivity = sequelize.define('TaskActivity', {
    taskId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM('created', 'status_changed'),
      allowNull: false,
      validate: {
        isIn: {
          args: [['created', 'status_changed']],
          msg: 'Type must be created or status_changed',
        },
      },
    },
    fromStatus: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: true,
    },
    toStatus: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: true,
    },
  });
  return TaskActivity;
};
