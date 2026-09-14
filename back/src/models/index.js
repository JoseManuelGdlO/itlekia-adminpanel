require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);
const Task = require('./task')(sequelize);

Project.hasMany(Task, { foreignKey: 'projectId', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
  Task,
};
