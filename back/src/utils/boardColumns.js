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

module.exports = { DEFAULT_BOARD_COLUMNS, seedDefaultColumns, firstColumn, toPublicColumn };
