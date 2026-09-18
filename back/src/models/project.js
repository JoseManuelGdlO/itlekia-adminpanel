const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Project = sequelize.define('Project', {
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('trabajando', 'parado', 'oculto', 'archivado'),
      allowNull: false,
      defaultValue: 'trabajando',
      validate: {
        isIn: {
          args: [['trabajando', 'parado', 'oculto', 'archivado']],
          msg: 'Invalid status',
        },
      },
    },
    costAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: null },
    contractSignedAt: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
    monthlyAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: null },
    monthlyPayDay: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  });

  return Project;
};
