const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM('admin', 'developer'),
      allowNull: false,
      validate: {
        isIn: {
          args: [['admin', 'developer']],
          msg: 'Role must be either admin or developer',
        },
      },
    },
  });

  return User;
};
