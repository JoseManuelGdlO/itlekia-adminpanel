const { BoardColumn } = require('../models');

const DEFAULT_BOARD_COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

async function seedDefaultColumns(projectId, transaction) {
  const cols = [];
  for (let position = 0; position < DEFAULT_BOARD_COLUMNS.length; position += 1) {
    const col = await BoardColumn.create(
      { projectId, name: DEFAULT_BOARD_COLUMNS[position], position },
      { transaction }
    );
    cols.push(col);
  }
  return cols;
}

async function firstColumn(projectId, transaction) {
  return BoardColumn.findOne({
    where: { projectId },
    order: [['position', 'ASC'], ['id', 'ASC']],
    transaction,
  });
}

function toPublicColumn(col) {
  return {
    id: col.id,
    projectId: col.projectId,
    name: col.name,
    position: col.position,
  };
}

function uniqueExtraName(name, taken) {
  if (!taken.has(name)) return name;
  let n = 2;
  let candidate = `${name} (${n})`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${name} (${n})`;
  }
  return candidate;
}

async function applyColumnNamesToProject(sourceColumns, destProjectId, transaction) {
  const dest = await BoardColumn.findAll({
    where: { projectId: destProjectId },
    order: [['position', 'ASC'], ['id', 'ASC']],
    transaction,
  });
  const extraOriginalNames = dest.slice(sourceColumns.length).map((column) => column.name);

  for (const column of dest) {
    column.name = `__tmp_${column.id}`;
    await column.save({ transaction });
  }

  for (let i = 0; i < sourceColumns.length; i += 1) {
    const name = sourceColumns[i].name;
    if (dest[i]) {
      dest[i].name = name;
      dest[i].position = i;
      await dest[i].save({ transaction });
    } else {
      await BoardColumn.create(
        { projectId: destProjectId, name, position: i },
        { transaction }
      );
    }
  }

  const taken = new Set(sourceColumns.map((column) => column.name));
  for (let i = sourceColumns.length; i < dest.length; i += 1) {
    const name = uniqueExtraName(extraOriginalNames[i - sourceColumns.length], taken);
    dest[i].name = name;
    await dest[i].save({ transaction });
    taken.add(name);
  }
}

module.exports = {
  DEFAULT_BOARD_COLUMNS,
  seedDefaultColumns,
  firstColumn,
  toPublicColumn,
  applyColumnNamesToProject,
};
