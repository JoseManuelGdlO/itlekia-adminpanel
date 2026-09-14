const app = require('./app');
const { sequelize } = require('./models');
const { startReminderJob } = require('./jobs/reminderJob');

const PORT = process.env.PORT || 4000;

async function main() {
  await sequelize.sync();
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`portal-admin-intk backend listening on port ${PORT}`);
  });
}

main();
