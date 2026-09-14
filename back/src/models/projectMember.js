const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProjectMember = sequelize.define(
    'ProjectMember',
    {
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      indexes: [{ unique: true, fields: ['projectId', 'userId'] }],
    }
  );
  return ProjectMember;
};
