require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
};
