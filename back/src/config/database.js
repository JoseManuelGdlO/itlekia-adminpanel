const isTest = process.env.NODE_ENV === 'test';

const config = isTest
  ? {
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    }
  : {
      dialect: 'mysql',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      logging: false,
    };

module.exports = config;
