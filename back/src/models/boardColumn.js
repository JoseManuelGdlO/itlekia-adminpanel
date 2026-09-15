const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BoardColumn = sequelize.define(
    'BoardColumn',
    {
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      indexes: [{ unique: true, fields: ['projectId', 'name'] }],
    }
  );
  return BoardColumn;
};
