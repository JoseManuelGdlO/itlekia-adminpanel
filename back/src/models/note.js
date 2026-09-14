const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Note = sequelize.define(
    'Note',
    {
      userId: { type: DataTypes.INTEGER, allowNull: false },
      projectId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        get() {
          return this.getDataValue('projectId') ?? null;
        }
      },
      taskId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        get() {
          return this.getDataValue('taskId') ?? null;
        }
      },
      title: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      isReminder: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      remindAt: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
          return this.getDataValue('remindAt') ?? null;
        }
      },
      notifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
          return this.getDataValue('notifiedAt') ?? null;
        }
      },
    },
    {
      validate: {
        notBothProjectAndTask() {
          if (this.projectId && this.taskId) {
            throw new Error('A note cannot be linked to both a project and a task');
          }
        },
      },
    }
  );

  return Note;
};
