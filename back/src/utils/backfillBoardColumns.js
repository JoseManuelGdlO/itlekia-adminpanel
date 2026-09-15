const { DataTypes, QueryTypes } = require('sequelize');
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

function isRestrictiveDeleteAction(action) {
  return ['RESTRICT', 'NO ACTION'].includes(String(action || '').toUpperCase());
}

async function foreignKeyDeleteActions() {
  if (sequelize.getDialect() === 'sqlite') {
    const rows = await sequelize.query('PRAGMA foreign_key_list(`Tasks`)', {
      type: QueryTypes.SELECT,
    });
    return rows.map((row) => ({
      columnName: row.from,
      referencedTableName: row.table,
      referencedColumnName: row.to,
      deleteAction: row.on_delete,
    }));
  }
  if (sequelize.getDialect() === 'mysql') {
    return sequelize.query(
      `SELECT
         kcu.CONSTRAINT_NAME AS constraintName,
         kcu.COLUMN_NAME AS columnName,
         kcu.REFERENCED_TABLE_NAME AS referencedTableName,
         kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
         rc.DELETE_RULE AS deleteAction
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
       JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
         ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.TABLE_NAME = kcu.TABLE_NAME
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
       WHERE kcu.CONSTRAINT_SCHEMA = :schema
         AND kcu.TABLE_NAME = 'Tasks'
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
      {
        replacements: { schema: sequelize.config.database },
        type: QueryTypes.SELECT,
      }
    );
  }
  return [];
}

function isTaskColumnForeignKey(foreignKey) {
  return (
    foreignKey.columnName === 'columnId' &&
    foreignKey.referencedTableName === 'BoardColumns' &&
    foreignKey.referencedColumnName === 'id'
  );
}

async function ensureTaskColumnForeignKey(queryInterface) {
  const foreignKeys = await queryInterface.getForeignKeyReferencesForTable('Tasks');
  let matchingForeignKeys = foreignKeys.filter(
    (foreignKey) =>
      foreignKey.constraintName === TASK_COLUMN_FOREIGN_KEY ||
      isTaskColumnForeignKey(foreignKey)
  );
  if (matchingForeignKeys.some((foreignKey) => !foreignKey.deleteAction && !foreignKey.onDelete)) {
    const actionMetadata = await foreignKeyDeleteActions();
    matchingForeignKeys = matchingForeignKeys.map((foreignKey) => {
      const metadata = actionMetadata.find(
        (candidate) =>
          (candidate.constraintName &&
            foreignKey.constraintName &&
            candidate.constraintName === foreignKey.constraintName) ||
          (candidate.columnName === foreignKey.columnName &&
            candidate.referencedTableName === foreignKey.referencedTableName &&
            candidate.referencedColumnName === foreignKey.referencedColumnName)
      );
      return metadata ? { ...foreignKey, ...metadata } : foreignKey;
    });
  }

  const incorrectForeignKeys = matchingForeignKeys.filter(
    (foreignKey) =>
      !isRestrictiveDeleteAction(foreignKey.deleteAction || foreignKey.onDelete)
  );
  for (const foreignKey of incorrectForeignKeys) {
    await queryInterface.removeConstraint(
      'Tasks',
      foreignKey.constraintName || TASK_COLUMN_FOREIGN_KEY
    );
  }

  if (
    matchingForeignKeys.some((foreignKey) =>
      isRestrictiveDeleteAction(foreignKey.deleteAction || foreignKey.onDelete)
    )
  ) {
    return;
  }

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
