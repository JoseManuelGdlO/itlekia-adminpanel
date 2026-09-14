require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);
const Task = require('./task')(sequelize);
const Note = require('./note')(sequelize);
const ProjectMember = require('./projectMember')(sequelize);

Project.hasMany(Task, { foreignKey: 'projectId', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

User.hasMany(Note, { foreignKey: 'userId', as: 'notes' });
Note.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

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

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
  Task,
  Note,
  ProjectMember,
};
