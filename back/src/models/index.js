require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);
const Task = require('./task')(sequelize);
const Note = require('./note')(sequelize);
const ProjectMember = require('./projectMember')(sequelize);
const TaskActivity = require('./taskActivity')(sequelize);
const FinanceItem = require('./financeItem')(sequelize);
const Feature = require('./feature')(sequelize);
const BoardColumn = require('./boardColumn')(sequelize);
const NoteNotify = require('./noteNotify')(sequelize);
const FeatureNotify = require('./featureNotify')(sequelize);

Project.hasMany(Task, {
  foreignKey: 'projectId',
  as: 'tasks',
  onDelete: 'CASCADE',
});
Task.belongsTo(Project, {
  foreignKey: 'projectId',
  as: 'project',
  onDelete: 'CASCADE',
});

User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

User.hasMany(Note, { foreignKey: 'userId', as: 'notes' });
Note.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

Note.belongsToMany(User, {
  through: NoteNotify,
  as: 'notifyUsers',
  foreignKey: 'noteId',
  otherKey: 'userId',
});
User.belongsToMany(Note, {
  through: NoteNotify,
  as: 'notifiedNotes',
  foreignKey: 'userId',
  otherKey: 'noteId',
});

Project.hasMany(Note, { foreignKey: 'projectId', as: 'notes' });
Note.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Task.hasMany(Note, { foreignKey: 'taskId', as: 'notes' });
Note.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });

Project.belongsToMany(User, {
  through: ProjectMember,
  as: 'members',
  foreignKey: 'projectId',
  otherKey: 'userId',
});
User.belongsToMany(Project, {
  through: ProjectMember,
  as: 'memberProjects',
  foreignKey: 'userId',
  otherKey: 'projectId',
});

Task.hasMany(TaskActivity, { foreignKey: 'taskId', as: 'activities' });
TaskActivity.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
User.hasMany(TaskActivity, { foreignKey: 'userId', as: 'taskActivities' });
TaskActivity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Project.hasMany(FinanceItem, { foreignKey: 'projectId', as: 'financeItems' });
FinanceItem.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
User.hasMany(FinanceItem, { foreignKey: 'createdBy', as: 'financeItems' });
FinanceItem.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Project.hasMany(Feature, { foreignKey: 'projectId', as: 'features' });
Feature.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
User.hasMany(Feature, { foreignKey: 'userId', as: 'features' });
Feature.belongsTo(User, { foreignKey: 'userId', as: 'creator' });

Feature.belongsToMany(User, {
  through: FeatureNotify,
  as: 'notifyUsers',
  foreignKey: 'featureId',
  otherKey: 'userId',
});
User.belongsToMany(Feature, {
  through: FeatureNotify,
  as: 'notifiedFeatures',
  foreignKey: 'userId',
  otherKey: 'featureId',
});

Project.hasMany(BoardColumn, { foreignKey: 'projectId', as: 'boardColumns' });
BoardColumn.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
BoardColumn.hasMany(Task, {
  foreignKey: 'columnId',
  as: 'tasks',
  onDelete: 'RESTRICT',
});
Task.belongsTo(BoardColumn, {
  foreignKey: 'columnId',
  as: 'column',
  onDelete: 'RESTRICT',
});

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
  Task,
  Note,
  ProjectMember,
  TaskActivity,
  FinanceItem,
  Feature,
  BoardColumn,
  NoteNotify,
  FeatureNotify,
};
