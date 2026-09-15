const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TaskActivity = sequelize.define('TaskActivity', {
    taskId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM('created', 'status_changed', 'assignee_changed'),
      allowNull: false,
      validate: {
        isIn: {
          args: [['created', 'status_changed', 'assignee_changed']],
          msg: 'Type must be created, status_changed, or assignee_changed',
        },
      },
    },
    fromStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    toStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });
  return TaskActivity;
};
