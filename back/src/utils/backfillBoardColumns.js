const { Project, BoardColumn, Task, TaskActivity } = require('../models');
const { seedDefaultColumns, firstColumn } = require('./boardColumns');

const SLUG_TO_NAME = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

async function mapActivitySlugs() {
  const rows = await TaskActivity.findAll();
  for (const row of rows) {
    const from = SLUG_TO_NAME[row.fromStatus];
    const to = SLUG_TO_NAME[row.toStatus];
    if (from) row.fromStatus = from;
    if (to) row.toStatus = to;
    if (from || to) await row.save();
  }
}

async function backfillBoardColumns() {
  if ((await BoardColumn.count()) === 0) {
    const projects = await Project.findAll();
    for (const project of projects) {
      await seedDefaultColumns(project.id);
    }
    const tasks = await Task.findAll();
    for (const task of tasks) {
      if (task.columnId) continue;
      const col = await firstColumn(task.projectId);
      if (col) {
        task.columnId = col.id;
        await task.save();
      }
    }
  }
  await mapActivitySlugs();
}

module.exports = { backfillBoardColumns, mapActivitySlugs };
