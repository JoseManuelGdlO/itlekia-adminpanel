const app = require('./app');
const { sequelize } = require('./models');
const { startReminderJob } = require('./jobs/reminderJob');
const { backfillProjectMembers } = require('./utils/backfillProjectMembers');

const PORT = process.env.PORT || 4000;

async function main() {
  await sequelize.sync();
  await backfillProjectMembers();
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`portal-admin-intk backend listening on port ${PORT}`);
  });
}

main();
