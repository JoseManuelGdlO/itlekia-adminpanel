const { sequelize, Project, BoardColumn } = require('../../src/models');
const { DEFAULT_BOARD_COLUMNS, seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('BoardColumn model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('seeds the four default columns in order', async () => {
    const project = await Project.create({ name: 'Website Revamp' });
    const cols = await seedDefaultColumns(project.id);
    expect(DEFAULT_BOARD_COLUMNS).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
    expect(cols.map((c) => c.name)).toEqual(DEFAULT_BOARD_COLUMNS);
    expect(cols.map((c) => c.position)).toEqual([0, 1, 2, 3]);
    const loaded = await BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC']],
    });
    expect(loaded).toHaveLength(4);
  });

  it('rejects a duplicate name on the same project', async () => {
    const project = await Project.create({ name: 'Other' });
    await BoardColumn.create({ projectId: project.id, name: 'To Do', position: 0 });
    await expect(
      BoardColumn.create({ projectId: project.id, name: 'To Do', position: 1 })
    ).rejects.toThrow();
  });
});
