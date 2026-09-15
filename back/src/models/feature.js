const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Feature = sequelize.define('Feature', {
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'done'),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: { args: [['pending', 'done']], msg: 'Invalid status' },
      },
    },
    isReminder: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    remindAt: { type: DataTypes.DATE, allowNull: true },
    notifiedAt: { type: DataTypes.DATE, allowNull: true },
  });
  return Feature;
};
