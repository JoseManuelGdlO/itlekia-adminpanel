const { DataTypes } = require('sequelize');

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
