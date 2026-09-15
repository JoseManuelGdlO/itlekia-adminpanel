const { DataTypes } = require('sequelize');
const { sequelize, Project, BoardColumn, Task, TaskActivity } = require('../models');
const { seedDefaultColumns, firstColumn } = require('./boardColumns');

const SLUG_TO_NAME = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};
const TASK_COLUMN_FOREIGN_KEY = 'tasks_column_id_fk';

function columnNameForStatus(slug) {
  return SLUG_TO_NAME[slug] || 'To Do';
}

function assignColumnFromLegacyStatus(task, statusSlug, columnsByName) {
  const column = columnsByName[columnNameForStatus(statusSlug)];
  if (column) task.columnId = column.id;
  return task;
}

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

async function ensureTaskColumnForeignKey(queryInterface) {
  const foreignKeys = await queryInterface.getForeignKeyReferencesForTable('Tasks');
  const exists = foreignKeys.some(
    (foreignKey) =>
      foreignKey.constraintName === TASK_COLUMN_FOREIGN_KEY ||
      (foreignKey.columnName === 'columnId' &&
        foreignKey.referencedTableName === 'BoardColumns' &&
        foreignKey.referencedColumnName === 'id')
  );
  if (exists) return;

  await queryInterface.addConstraint('Tasks', {
    fields: ['columnId'],
    type: 'foreign key',
    name: TASK_COLUMN_FOREIGN_KEY,
    references: { table: 'BoardColumns', field: 'id' },
    onDelete: 'RESTRICT',
  });
}

async function backfillBoardColumns() {
  const queryInterface = sequelize.getQueryInterface();
  let taskColumns = await queryInterface.describeTable('Tasks');
  if (!taskColumns.columnId) {
    await queryInterface.addColumn('Tasks', 'columnId', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    taskColumns = await queryInterface.describeTable('Tasks');
  }

  const projects = await Project.findAll();
  for (const project of projects) {
    if ((await BoardColumn.count({ where: { projectId: project.id } })) === 0) {
      await seedDefaultColumns(project.id);
    }
  }

  if (taskColumns.status) {
    const [legacyTasks] = await sequelize.query(
      'SELECT id, projectId, status, columnId FROM Tasks'
    );
    const columnsByProject = new Map();
    for (const task of legacyTasks) {
      if (task.columnId) continue;
      if (!columnsByProject.has(task.projectId)) {
        const columns = await BoardColumn.findAll({ where: { projectId: task.projectId } });
        columnsByProject.set(
          task.projectId,
          Object.fromEntries(columns.map((column) => [column.name, column]))
        );
      }
      assignColumnFromLegacyStatus(task, task.status, columnsByProject.get(task.projectId));
      if (task.columnId) {
        await Task.update({ columnId: task.columnId }, { where: { id: task.id } });
      }
    }
  }

  const tasks = await Task.findAll({ where: { columnId: null } });
  for (const task of tasks) {
    const col = await firstColumn(task.projectId);
    if (col) {
      task.columnId = col.id;
      await task.save();
    }
  }

  if (taskColumns.columnId.allowNull !== false) {
    // Keep the FK separate: MySQL Sequelize emits only ADD FOREIGN KEY when
    // references are included here, so the column would remain nullable.
    await queryInterface.changeColumn('Tasks', 'columnId', {
      type: DataTypes.INTEGER,
      allowNull: false,
    });
  }
  await ensureTaskColumnForeignKey(queryInterface);
  if (taskColumns.status) {
    await queryInterface.removeColumn('Tasks', 'status');
  }

  const activityColumns = await queryInterface.describeTable('TaskActivities');
  for (const name of ['fromStatus', 'toStatus']) {
    const type = String(activityColumns[name]?.type || '').toUpperCase();
    if (!type.startsWith('VARCHAR')) {
      await queryInterface.changeColumn('TaskActivities', name, {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  }
  await mapActivitySlugs();
}

module.exports = {
  backfillBoardColumns,
  mapActivitySlugs,
  columnNameForStatus,
  assignColumnFromLegacyStatus,
};
