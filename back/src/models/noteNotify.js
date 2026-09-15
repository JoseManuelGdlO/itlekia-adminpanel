const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NoteNotify = sequelize.define(
    'NoteNotify',
    {
      noteId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      indexes: [{ unique: true, fields: ['noteId', 'userId'] }],
    }
  );
  return NoteNotify;
};
