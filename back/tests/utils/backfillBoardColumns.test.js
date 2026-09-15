const { DataTypes, Op } = require('sequelize');
const { sequelize, Project, BoardColumn, TaskActivity, User, Task } = require('../../src/models');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');
const {
  backfillBoardColumns,
  columnNameForStatus,
} = require('../../src/utils/backfillBoardColumns');

describe('backfillBoardColumns', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('seeds defaults for projects with no columns and is a no-op the second time', async () => {
    const project = await Project.create({ name: 'Legacy' });
    expect(await BoardColumn.count()).toBe(0);
    await backfillBoardColumns();
    const cols = await BoardColumn.findAll({
      where: { projectId: project.id },
      order: [['position', 'ASC']],
    });
    expect(cols.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
    const n = await BoardColumn.count();
    await backfillBoardColumns();
    expect(await BoardColumn.count()).toBe(n);
  });

  it('does not seed a later project after any board column exists', async () => {
    const project = await Project.create({ name: 'Later project' });

    await backfillBoardColumns();

    expect(await BoardColumn.count({ where: { projectId: project.id } })).toBe(0);
    const n = await BoardColumn.count();
    await backfillBoardColumns();
    expect(await BoardColumn.count()).toBe(n);
  });

  it('rewrites activity slugs to default labels even when columns already exist', async () => {
    const project = await Project.create({ name: 'Act' });
    const [todoCol] = await seedDefaultColumns(project.id);
    const user = await User.create({
      name: 'A',
      email: 'a@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
    const task = await Task.create({ projectId: project.id, title: 'T', columnId: todoCol.id });
    const row = await TaskActivity.create({
      taskId: task.id,
      userId: user.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'todo',
    });
    await backfillBoardColumns();
    await row.reload();
    expect(row.toStatus).toBe('To Do');
  });

  it.each([
    ['todo', 'To Do'],
    ['in_progress', 'In Progress'],
    ['review', 'Review'],
    ['done', 'Done'],
    ['unknown', 'To Do'],
    [null, 'To Do'],
  ])('maps legacy status %p to %s', (slug, expected) => {
    expect(columnNameForStatus(slug)).toBe(expected);
  });

  it('adds columnId to a legacy Tasks table and preserves legacy status placement', async () => {
    const project = await Project.create({ name: 'Legacy status project' });
    await seedDefaultColumns(project.id);
    const queryInterface = sequelize.getQueryInterface();
    const addColumnSpy = jest.spyOn(queryInterface, 'addColumn');
    const changeColumnSpy = jest.spyOn(queryInterface, 'changeColumn');
    const addConstraintSpy = jest.spyOn(queryInterface, 'addConstraint');

    await queryInterface.removeColumn('Tasks', 'columnId');
    await queryInterface.addColumn('Tasks', 'status', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await sequelize.query(
      `INSERT INTO Tasks
        (title, status, createdAt, updatedAt, projectId)
       VALUES
        ('Legacy in progress', 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :projectId)`,
      { replacements: { projectId: project.id } }
    );

    await backfillBoardColumns();

    let table = await queryInterface.describeTable('Tasks');
    expect(table.status).toBeUndefined();
    expect(table.columnId).toBeDefined();
    expect(table.columnId.allowNull).toBe(false);
    expect(addColumnSpy).toHaveBeenCalledWith(
      'Tasks',
      'columnId',
      expect.not.objectContaining({ references: expect.anything() })
    );
    expect(changeColumnSpy).toHaveBeenCalledWith(
      'Tasks',
      'columnId',
      expect.not.objectContaining({ references: expect.anything() })
    );
    expect(addConstraintSpy).toHaveBeenCalledTimes(1);
    expect(addConstraintSpy).toHaveBeenCalledWith('Tasks', {
      fields: ['columnId'],
      type: 'foreign key',
      name: 'tasks_column_id_fk',
      references: { table: 'BoardColumns', field: 'id' },
      onDelete: 'RESTRICT',
    });
    const [rows] = await sequelize.query(
      `SELECT c.name
       FROM Tasks t
       JOIN BoardColumns c ON c.id = t.columnId
       WHERE t.title = 'Legacy in progress'`
    );
    expect(rows).toEqual([{ name: 'In Progress' }]);

    await backfillBoardColumns();
    table = await queryInterface.describeTable('Tasks');
    expect(table.status).toBeUndefined();
    expect(addConstraintSpy).toHaveBeenCalledTimes(1);
  });

  it('restricts deleting a populated column and allows deleting an empty column', async () => {
    await sequelize.query('PRAGMA foreign_keys = ON');
    const project = await Project.create({ name: 'Restricted columns project' });
    const [populatedColumn, emptyColumn] = await seedDefaultColumns(project.id);
    await Task.create({
      projectId: project.id,
      title: 'Column dependency',
      columnId: populatedColumn.id,
    });

    await expect(populatedColumn.destroy()).rejects.toThrow();
    await expect(emptyColumn.destroy()).resolves.toBeDefined();
  });

  it('replaces a matching task column foreign key whose delete action is not restrictive', async () => {
    const queryInterface = sequelize.getQueryInterface();
    const getForeignKeyReferencesForTable =
      queryInterface.getForeignKeyReferencesForTable.bind(queryInterface);
    const getForeignKeysSpy = jest
      .spyOn(queryInterface, 'getForeignKeyReferencesForTable')
      .mockImplementation((tableName) =>
        tableName === 'Tasks'
          ? Promise.resolve([
              {
                constraintName: 'tasks_column_id_fk',
                columnName: 'columnId',
                referencedTableName: 'BoardColumns',
                referencedColumnName: 'id',
                deleteAction: 'CASCADE',
              },
            ])
          : getForeignKeyReferencesForTable(tableName)
      );
    const removeConstraintSpy = jest
      .spyOn(queryInterface, 'removeConstraint')
      .mockResolvedValue();
    const addConstraintSpy = jest.spyOn(queryInterface, 'addConstraint').mockResolvedValue();

    await backfillBoardColumns();

    expect(removeConstraintSpy).toHaveBeenCalledWith('Tasks', 'tasks_column_id_fk');
    expect(addConstraintSpy).toHaveBeenCalledWith('Tasks', {
      fields: ['columnId'],
      type: 'foreign key',
      name: 'tasks_column_id_fk',
      references: { table: 'BoardColumns', field: 'id' },
      onDelete: 'RESTRICT',
    });

    getForeignKeysSpy.mockRestore();
    removeConstraintSpy.mockRestore();
    addConstraintSpy.mockRestore();
  });

  it('replaces a restrictive named task column foreign key that targets the wrong relation', async () => {
    const queryInterface = sequelize.getQueryInterface();
    const getForeignKeyReferencesForTable =
      queryInterface.getForeignKeyReferencesForTable.bind(queryInterface);
    const getForeignKeysSpy = jest
      .spyOn(queryInterface, 'getForeignKeyReferencesForTable')
      .mockImplementation((tableName) =>
        tableName === 'Tasks'
          ? Promise.resolve([
              {
                constraintName: 'tasks_column_id_fk',
                columnName: 'projectId',
                referencedTableName: 'Projects',
                referencedColumnName: 'id',
                deleteAction: 'RESTRICT',
              },
            ])
          : getForeignKeyReferencesForTable(tableName)
      );
    const removeConstraintSpy = jest
      .spyOn(queryInterface, 'removeConstraint')
      .mockResolvedValue();
    const addConstraintSpy = jest.spyOn(queryInterface, 'addConstraint').mockResolvedValue();

    await backfillBoardColumns();

    expect(removeConstraintSpy).toHaveBeenCalledWith('Tasks', 'tasks_column_id_fk');
    expect(addConstraintSpy).toHaveBeenCalledWith('Tasks', {
      fields: ['columnId'],
      type: 'foreign key',
      name: 'tasks_column_id_fk',
      references: { table: 'BoardColumns', field: 'id' },
      onDelete: 'RESTRICT',
    });

    getForeignKeysSpy.mockRestore();
    removeConstraintSpy.mockRestore();
    addConstraintSpy.mockRestore();
  });

  it('fills leftover null columnId even when default columns already exist', async () => {
    const project = await Project.create({ name: 'Leftover fill project' });
    const [first] = await seedDefaultColumns(project.id);
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.changeColumn('Tasks', 'columnId', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    await sequelize.query(
      `INSERT INTO Tasks
        (title, createdAt, updatedAt, projectId, columnId)
       VALUES
        ('Needs first column', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :projectId, NULL)`,
      { replacements: { projectId: project.id } }
    );

    await backfillBoardColumns();

    const [rows] = await sequelize.query(
      `SELECT columnId FROM Tasks WHERE title = 'Needs first column'`
    );
    expect(rows).toEqual([{ columnId: first.id }]);
  });

  it('only loads leftover status slugs and does not rename a todo column', async () => {
    const project = await Project.create({ name: 'Slug filter project' });
    await seedDefaultColumns(project.id);
    const todoColumn = await BoardColumn.create({
      projectId: project.id,
      name: 'todo',
      position: 99,
    });
    const user = await User.create({
      name: 'Slug',
      email: 'slug@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
    const task = await Task.create({
      projectId: project.id,
      title: 'Slug task',
      columnId: todoColumn.id,
    });
    const slugRow = await TaskActivity.create({
      taskId: task.id,
      userId: user.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'todo',
    });
    const customRow = await TaskActivity.create({
      taskId: task.id,
      userId: user.id,
      type: 'status_changed',
      fromStatus: 'To Do',
      toStatus: 'Blocked',
    });

    const findAllSpy = jest.spyOn(TaskActivity, 'findAll');
    await backfillBoardColumns();
    expect(findAllSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          [Op.or]: [
            { fromStatus: ['todo', 'in_progress', 'review', 'done'] },
            { toStatus: ['todo', 'in_progress', 'review', 'done'] },
          ],
        },
      })
    );
    findAllSpy.mockRestore();

    await slugRow.reload();
    await customRow.reload();
    await todoColumn.reload();
    expect(slugRow.toStatus).toBe('To Do');
    expect(customRow.toStatus).toBe('Blocked');
    expect(todoColumn.name).toBe('todo');
  });

  it('does not throw when leftover tasks have null columnId that cannot be filled', async () => {
    await sequelize.query('PRAGMA foreign_keys = OFF');
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.changeColumn('Tasks', 'columnId', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    await sequelize.query(
      `INSERT INTO Tasks
        (title, createdAt, updatedAt, projectId, columnId)
       VALUES
        ('Orphan leftover', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL)`
    );

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const changeColumnSpy = jest.spyOn(queryInterface, 'changeColumn');
    changeColumnSpy.mockClear();

    await expect(backfillBoardColumns()).resolves.toBeUndefined();
    expect(changeColumnSpy).not.toHaveBeenCalledWith(
      'Tasks',
      'columnId',
      expect.objectContaining({ allowNull: false })
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/1/));

    changeColumnSpy.mockClear();
    await expect(backfillBoardColumns()).resolves.toBeUndefined();
    expect(changeColumnSpy).not.toHaveBeenCalledWith(
      'Tasks',
      'columnId',
      expect.objectContaining({ allowNull: false })
    );

    changeColumnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
