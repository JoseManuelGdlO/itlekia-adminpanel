const app = require('./app');
const { sequelize } = require('./models');
const { startReminderJob } = require('./jobs/reminderJob');
const { backfillProjectMembers } = require('./utils/backfillProjectMembers');
const { backfillBoardColumns } = require('./utils/backfillBoardColumns');
const { ensureProjectStatuses } = require('./utils/ensureProjectStatuses');
const { ensureTaskActivityTypes } = require('./utils/ensureTaskActivityTypes');
const { ensureTaskEstimatedHours } = require('./utils/ensureTaskEstimatedHours');

const PORT = process.env.PORT || 4000;

async function main() {
  await sequelize.sync();
  await ensureTaskEstimatedHours();
  await ensureProjectStatuses();
  await ensureTaskActivityTypes();
  await backfillProjectMembers();
  await backfillBoardColumns();
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`portal-admin-intk backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
