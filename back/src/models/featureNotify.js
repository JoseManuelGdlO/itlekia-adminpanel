const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FeatureNotify = sequelize.define(
    'FeatureNotify',
    {
      featureId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      indexes: [{ unique: true, fields: ['featureId', 'userId'] }],
    }
  );
  return FeatureNotify;
};
