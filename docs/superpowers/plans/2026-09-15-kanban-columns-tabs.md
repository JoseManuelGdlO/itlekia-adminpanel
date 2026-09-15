# Kanban columns and project tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins define per-project Kanban columns (add, rename, reorder, delete if empty) and switch projects with tabs instead of a dropdown; new tasks land in the leftmost column.

**Architecture:** New `BoardColumn` rows per project. `Task.columnId` replaces the `status` ENUM. `TaskActivity.fromStatus` / `toStatus` store the column **name** at event time. Columns API lives under `/projects/:id/columns`. The Kanban page fetches columns for the active tab and uses dnd-kit droppable ids = `String(column.id)`.

**Tech Stack:** Express, Sequelize, React 19, Vitest, `@dnd-kit/core` + `@dnd-kit/sortable` (already in `front/package.json`). No new packages.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-15-kanban-columns-tabs-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. Finance, features, notes, and membership stay unchanged.
- Error bodies `{ error: string }` with exact strings: `Project not found`, `Forbidden`, `Column not found`, `Invalid name`, `Column not empty`, `Invalid order`, `Invalid column`, `Task not found`.
- Default column names **in this order**: `To Do`, `In Progress`, `Review`, `Done`.
- Exact UI copy: `Nueva tarea`, `+ Columna`. Tabs use `project.name`. Do not render a project `combobox`.
- Developers never create/rename/reorder/delete columns.
- New tasks without `columnId` use the lowest `position` column.
- TDD: failing test first. Commit after each task. Do not push.
- Do not implement on a dirty `master`. At execution time use `superpowers:using-git-worktrees` on a branch such as `feat/kanban-columns-tabs`.

## File map

| File | Role |
|---|---|
| `back/src/models/boardColumn.js` | Column row (`name`, `position`) |
| `back/src/utils/boardColumns.js` | Default names + `seedDefaultColumns` / `firstColumn` |
| `back/src/utils/backfillBoardColumns.js` | One-shot seed + map leftover null `columnId` |
| `back/src/models/task.js` | `columnId` instead of `status` ENUM |
| `back/src/models/taskActivity.js` | `fromStatus` / `toStatus` STRING |
| `back/src/models/index.js` | Associations + export `BoardColumn` |
| `back/src/controllers/projectsController.js` | Seed columns on create |
| `back/src/controllers/columnsController.js` | Column CRUD + reorder |
| `back/src/controllers/tasksController.js` | Default column; `PATCH` column |
| `back/src/routes/projects.js` | Mount column routes before `PUT /:id` |
| `back/src/routes/tasks.js` | `PATCH /:id/column`; remove `/:id/status` |
| `back/src/server.js` | Call backfill after members backfill |
| `front/src/api/columns.js` | Column client |
| `front/src/api/tasks.js` | `updateTaskColumn` |
| `front/src/pages/KanbanPage.jsx` | Tabs + columns + drag |
| `front/src/components/kanban/KanbanColumn.jsx` | Named column + admin chrome |
| `front/src/components/kanban/TaskCard.jsx` | Dot by `position` |
| `front/src/pages/TaskDetailPage.jsx` | Activity shows stored names |

---

### Task 1: BoardColumn model

**Files:**
- Create: `back/src/models/boardColumn.js`
- Create: `back/src/utils/boardColumns.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/boardColumn.test.js`

**Interfaces:**
- Consumes: existing `Project`, `sequelize`.
- Produces: `BoardColumn` with `projectId` INTEGER required, `name` STRING required, `position` INTEGER required. Unique `(projectId, name)`. Associations: `Project.hasMany(BoardColumn, { foreignKey: 'projectId', as: 'boardColumns' })`, `BoardColumn.belongsTo(Project, { foreignKey: 'projectId', as: 'project' })`. Export `BoardColumn`. `DEFAULT_BOARD_COLUMNS = ['To Do', 'In Progress', 'Review', 'Done']`. `async function seedDefaultColumns(projectId)` creates those four at positions `0..3` and returns them in order.

- [ ] **Step 1: Write the failing test**

Create `back/tests/models/boardColumn.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd back
npm test -- tests/models/boardColumn.test.js
```

Expected: FAIL (`Cannot find module` for `boardColumn` or `boardColumns`).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/models/boardColumn.js`:

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BoardColumn = sequelize.define(
    'BoardColumn',
    {
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      indexes: [{ unique: true, fields: ['projectId', 'name'] }],
    }
  );
  return BoardColumn;
};
```

Create `back/src/utils/boardColumns.js`:

```javascript
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
```

In `back/src/models/index.js` add `const BoardColumn = require('./boardColumn')(sequelize);` after `Feature`, then:

```javascript
Project.hasMany(BoardColumn, { foreignKey: 'projectId', as: 'boardColumns' });
BoardColumn.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
```

And export `BoardColumn` from `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd back
npm test -- tests/models/boardColumn.test.js
npm test
```

Expected: PASS. `boardColumns.js` must require `{ BoardColumn }` from `../models` the same way `backfillProjectMembers.js` does (inside the file, not from `index.js`). If Jest reports a circular-require undefined `BoardColumn`, move `const { BoardColumn } = require('../models');` **inside** `seedDefaultColumns` and `firstColumn`.

- [ ] **Step 5: Commit**

```bash
git add back/src/models/boardColumn.js back/src/utils/boardColumns.js back/src/models/index.js back/tests/models/boardColumn.test.js
git commit -m "$(cat <<'EOF'
feat: add BoardColumn model and default column seed helper

EOF
)"
```

---

### Task 2: Seed columns when a project is created

**Files:**
- Modify: `back/src/controllers/projectsController.js`
- Modify: `back/tests/routes/projects.test.js`

**Interfaces:**
- Consumes: `seedDefaultColumns(projectId)`.
- Produces: `POST /projects` (admin) creates the four default columns for the new project in the same request. Direct `Project.create` in tests does **not** seed (only the HTTP create path).

- [ ] **Step 1: Write the failing test**

In `back/tests/routes/projects.test.js` require `BoardColumn` and append:

```javascript
  it('admin create seeds To Do, In Progress, Review, Done', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'Boarded', description: 'x' });
    expect(res.status).toBe(201);
    const cols = await BoardColumn.findAll({
      where: { projectId: res.body.id },
      order: [['position', 'ASC']],
    });
    expect(cols.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd back
npm test -- tests/routes/projects.test.js
```

Expected: FAIL (`cols` length 0).

- [ ] **Step 3: Write minimal implementation**

In `projectsController.js` require `{ Project, sequelize }` (add sequelize) and `{ seedDefaultColumns }` from `../utils/boardColumns`. Replace `create`:

```javascript
async function create(req, res) {
  const { name, description } = req.body;
  const t = await sequelize.transaction();
  try {
    const project = await Project.create({ name, description }, { transaction: t });
    await seedDefaultColumns(project.id, t);
    await t.commit();
    return res.status(201).json(project);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd back
npm test -- tests/routes/projects.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/projectsController.js back/tests/routes/projects.test.js
git commit -m "$(cat <<'EOF'
feat: seed default Kanban columns when creating a project

EOF
)"
```

---

### Task 3: Task.columnId and activity name strings

**Files:**
- Modify: `back/src/models/task.js`
- Modify: `back/src/models/taskActivity.js`
- Modify: `back/src/models/index.js` (Task ↔ BoardColumn)
- Create: `back/src/utils/backfillBoardColumns.js`
- Modify: `back/src/server.js`
- Test: `back/tests/utils/backfillBoardColumns.test.js`
- Modify tests that `Task.create` without `columnId`: `back/tests/models/task.test.js`, `back/tests/models/taskActivity.test.js`, `back/tests/models/note.test.js`, `back/tests/routes/tasks.test.js`, `back/tests/routes/projects.test.js`, `back/tests/routes/members.test.js`, `back/tests/utils/backfillProjectMembers.test.js`

**Interfaces:**
- Consumes: `BoardColumn`, `seedDefaultColumns`.
- Produces: `Task.columnId` INTEGER `allowNull: false`. No `status` field. `Task.belongsTo(BoardColumn, { foreignKey: 'columnId', as: 'column' })`, `BoardColumn.hasMany(Task, { foreignKey: 'columnId', as: 'tasks' })`. `TaskActivity.fromStatus` / `toStatus` = `DataTypes.STRING`, allowNull true. `backfillBoardColumns()` skips **seeding** when `BoardColumn.count() > 0`, then **always** maps activity slugs `todo→To Do`, `in_progress→In Progress`, `review→Review`, `done→Done`. `POST /tasks` sets `columnId` from `firstColumn`. `PATCH /:id/status` still exists in this task: body slug maps to the column **name** on that project (so the suite stays green until Task 5).

Because `columnId` is required, every `Task.create` in tests must pass `columnId`. In each affected `beforeAll` (or per test), after `Project.create`, `const [todoCol] = await seedDefaultColumns(project.id)` (or create one column) and pass `columnId: todoCol.id`.

- [ ] **Step 1: Write the failing tests**

Replace `back/tests/models/task.test.js` default/invalid-status cases with:

```javascript
const { sequelize, Project, User, Task, BoardColumn } = require('../../src/models');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('Task model', () => {
  let project;
  let developer;
  let todoCol;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'Website Revamp' });
    developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
    [todoCol] = await seedDefaultColumns(project.id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a task linked to a column and project', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Build homepage',
      columnId: todoCol.id,
    });
    expect(task.columnId).toBe(todoCol.id);
    expect(task.status).toBeUndefined();
    const withProject = await Task.findByPk(task.id, { include: 'project' });
    expect(withProject.project.name).toBe('Website Revamp');
  });

  it('assigns a task to a user via the assignee association', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Fix nav bug',
      assigneeId: developer.id,
      columnId: todoCol.id,
    });
    const withAssignee = await Task.findByPk(task.id, { include: 'assignee' });
    expect(withAssignee.assignee.email).toBe('dev1@example.com');
  });
});
```

Create `back/tests/utils/backfillBoardColumns.test.js`:

```javascript
const { sequelize, Project, BoardColumn, TaskActivity, User, Task } = require('../../src/models');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');
const { backfillBoardColumns } = require('../../src/utils/backfillBoardColumns');

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
});
```

In `taskActivity.test.js` after creating the project, `seedDefaultColumns` and pass `columnId`. Keep `toStatus: 'todo'` as a STRING. Keep invalid `type` rejection.

Patch every other `Task.create({...})` with `columnId` from a seeded column. In `projects.test.js` `beforeAll`, seed columns on `otherProject` before the orphan task. In `tasks.test.js` expect create activity `toStatus` `'To Do'`; PATCH `/status` still works and `res.body.columnId` is defined (drop `res.body.status`). In `activities.test.js` expect `'To Do'` / `'In Progress'`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd back
npm test -- tests/models/task.test.js
```

Expected: FAIL (`columnId` / `status` still ENUM).

- [ ] **Step 3: Write minimal implementation**

`back/src/models/task.js` — remove `status`; add:

```javascript
columnId: { type: DataTypes.INTEGER, allowNull: false },
```

`back/src/models/taskActivity.js` — `fromStatus` and `toStatus`: `{ type: DataTypes.STRING, allowNull: true }` (drop `STATUSES` ENUM).

`index.js`:

```javascript
BoardColumn.hasMany(Task, { foreignKey: 'columnId', as: 'tasks' });
Task.belongsTo(BoardColumn, { foreignKey: 'columnId', as: 'column' });
```

`back/src/utils/backfillBoardColumns.js`:

```javascript
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
```

`server.js` after `backfillProjectMembers()`: `await backfillBoardColumns();`

Update all `Task.create` call sites listed above.

In `tasksController.js` require `BoardColumn` and `{ firstColumn }` from `../utils/boardColumns`. Replace the Task.create + activity block inside `create` with the snippet below. Replace `updateStatus` with the snippet below (route stays `PATCH /:id/status` until Task 5).

```javascript
async function updateStatus(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!isOwnerOrAdmin(task, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const raw = req.body.status;
  const name = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' }[raw] || raw;
  const column = await BoardColumn.findOne({ where: { projectId: task.projectId, name } });
  if (!column) return res.status(400).json({ error: 'Invalid column' });
  if (task.columnId === column.id) return res.json(task);
  const from = await BoardColumn.findByPk(task.columnId);
  const t = await sequelize.transaction();
  try {
    task.columnId = column.id;
    await task.save({ transaction: t });
    await TaskActivity.create(
      {
        taskId: task.id,
        userId: req.user.id,
        type: 'status_changed',
        fromStatus: from ? from.name : null,
        toStatus: column.name,
      },
      { transaction: t }
    );
    await t.commit();
    return res.json(task);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}
```

And `create`:

```javascript
  const column = await firstColumn(project.id);
  if (!column) {
    return res.status(400).json({ error: 'Invalid column' });
  }
  const task = await Task.create(
    { projectId, title, description, assigneeId, dueDate, columnId: column.id },
    { transaction: t }
  );
  await TaskActivity.create(
    {
      taskId: task.id,
      userId: req.user.id,
      type: 'created',
      fromStatus: null,
      toStatus: column.name,
    },
    { transaction: t }
  );
```

Update PATCH tests: `expect(res.body.columnId).toBeDefined()`; drop `expect(res.body.status)`. Update activities test `toStatus: 'To Do'` and `'In Progress'`. `tasks.test.js` `toStatus` on create: `'To Do'`.

- [ ] **Step 4: Run tests**

```bash
cd back
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/models/task.js back/src/models/taskActivity.js back/src/models/index.js back/src/utils/backfillBoardColumns.js back/src/server.js back/src/controllers/tasksController.js back/tests
git commit -m "$(cat <<'EOF'
feat: store tasks on BoardColumn instead of status slugs

EOF
)"
```

---

### Task 4: Columns HTTP API

**Files:**
- Create: `back/src/controllers/columnsController.js`
- Modify: `back/src/routes/projects.js`
- Test: `back/tests/routes/columns.test.js`

**Interfaces:**
- Consumes: `BoardColumn`, `Task`, `isProjectMember`, `toPublicColumn`, `loadProject` pattern from `membersController`.
- Produces:
  - `GET /projects/:id/columns` — admin or member; 403 otherwise; `position ASC, id ASC`.
  - `POST /projects/:id/columns` — `requireRole('admin')`. Body `{ name }`. Trim; empty or duplicate → 400 `{ error: 'Invalid name' }`. Position = `max+1` or 0. 201 public column.
  - `PUT /projects/:id/columns/reorder` — admin. `{ columnIds: number[] }` permutation of all ids. 400 `{ error: 'Invalid order' }`. 200 public list.
  - `PUT /projects/:id/columns/:columnId` — admin rename, same name rules. 404 `{ error: 'Column not found' }`.
  - `DELETE` — admin. If `Task.count({ where: { columnId } }) > 0` → 409 `{ error: 'Column not empty' }`. Else 204.

Mount **before** `router.put('/:id'`, and mount `/columns/reorder` **before** `/columns/:columnId`.

- [ ] **Step 1: Write the failing test**

Create `back/tests/routes/columns.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, ProjectMember, Task, BoardColumn } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('column routes', () => {
  let adminCookie;
  let memberCookie;
  let outsiderCookie;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const member = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    const outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    memberCookie = `token=${signToken({ id: member.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: member.id });
    await seedDefaultColumns(project.id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('member lists columns in position order; outsider is forbidden', async () => {
    const ok = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', memberCookie);
    expect(ok.status).toBe(200);
    expect(ok.body.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
    expect(ok.body[0].storedName).toBeUndefined();
    const no = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', outsiderCookie);
    expect(no.status).toBe(403);
    expect(no.body).toEqual({ error: 'Forbidden' });
  });

  it('admin creates, renames, reorders, and deletes an empty column', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: '  Blocked  ' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Blocked');

    const renamed = await request(app)
      .put(`/projects/${project.id}/columns/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Waiting' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Waiting');

    const listed = await request(app).get(`/projects/${project.id}/columns`).set('Cookie', adminCookie);
    const ids = listed.body.map((c) => c.id);
    const reversed = [...ids].reverse();
    const reordered = await request(app)
      .put(`/projects/${project.id}/columns/reorder`)
      .set('Cookie', adminCookie)
      .send({ columnIds: reversed });
    expect(reordered.status).toBe(200);
    expect(reordered.body.map((c) => c.id)).toEqual(reversed);

    const del = await request(app)
      .delete(`/projects/${project.id}/columns/${created.body.id}`)
      .set('Cookie', adminCookie);
    expect(del.status).toBe(204);
  });

  it('rejects empty name, duplicate name, delete with tasks, and developer writes', async () => {
    const cols = await BoardColumn.findAll({ where: { projectId: project.id } });
    const empty = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: '   ' });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: 'Invalid name' });

    const dup = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', adminCookie)
      .send({ name: 'To Do' });
    expect(dup.status).toBe(400);

    const todo = cols.find((c) => c.name === 'To Do');
    await Task.create({ projectId: project.id, title: 'Stay', columnId: todo.id });
    const blocked = await request(app)
      .delete(`/projects/${project.id}/columns/${todo.id}`)
      .set('Cookie', adminCookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({ error: 'Column not empty' });

    const post = await request(app)
      .post(`/projects/${project.id}/columns`)
      .set('Cookie', memberCookie)
      .send({ name: 'Nope' });
    expect(post.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd back
npm test -- tests/routes/columns.test.js
```

Expected: FAIL (404, no `/columns`).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/controllers/columnsController.js`:

```javascript
const { BoardColumn, Task } = require('../models');
const { isProjectMember } = require('../utils/projectAccess');
const { toPublicColumn } = require('../utils/boardColumns');

async function loadProject(req, res) {
  const { Project } = require('../models');
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

function normalizeName(value) {
  return String(value ?? '').trim();
}

async function assertAdminOrMember(req, res, project) {
  if (req.user.role === 'admin') return true;
  const allowed = await isProjectMember(req.user.id, project.id);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

async function loadColumn(req, res, project) {
  const column = await BoardColumn.findOne({
    where: { id: req.params.columnId, projectId: project.id },
  });
  if (!column) {
    res.status(404).json({ error: 'Column not found' });
    return null;
  }
  return column;
}

async function list(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  if (!(await assertAdminOrMember(req, res, project))) return;
  const cols = await BoardColumn.findAll({
    where: { projectId: project.id },
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  return res.json(cols.map(toPublicColumn));
}

async function create(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Invalid name' });
  const dup = await BoardColumn.findOne({ where: { projectId: project.id, name } });
  if (dup) return res.status(400).json({ error: 'Invalid name' });
  const max = await BoardColumn.max('position', { where: { projectId: project.id } });
  const position = Number.isFinite(max) ? max + 1 : 0;
  const column = await BoardColumn.create({ projectId: project.id, name, position });
  return res.status(201).json(toPublicColumn(column));
}

async function update(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const column = await loadColumn(req, res, project);
  if (!column) return;
  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Invalid name' });
  const dup = await BoardColumn.findOne({ where: { projectId: project.id, name } });
  if (dup && dup.id !== column.id) return res.status(400).json({ error: 'Invalid name' });
  column.name = name;
  await column.save();
  return res.json(toPublicColumn(column));
}

async function reorder(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const ids = req.body.columnIds;
  const existing = await BoardColumn.findAll({ where: { projectId: project.id } });
  const existingIds = existing.map((c) => c.id).sort((a, b) => a - b);
  const incoming = Array.isArray(ids) ? ids.map(Number) : [];
  const sortedIn = [...incoming].sort((a, b) => a - b);
  if (
    incoming.length !== existingIds.length ||
    existingIds.some((id, i) => id !== sortedIn[i]) ||
    new Set(incoming).size !== incoming.length
  ) {
    return res.status(400).json({ error: 'Invalid order' });
  }
  for (let position = 0; position < incoming.length; position += 1) {
    const col = existing.find((c) => c.id === incoming[position]);
    col.position = position;
    await col.save();
  }
  const cols = await BoardColumn.findAll({
    where: { projectId: project.id },
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  return res.json(cols.map(toPublicColumn));
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const column = await loadColumn(req, res, project);
  if (!column) return;
  const used = await Task.count({ where: { columnId: column.id } });
  if (used > 0) return res.status(409).json({ error: 'Column not empty' });
  await column.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, reorder, remove };
```

In `projects.js` require `columns` controller and **before** `router.put('/:id'`:

```javascript
router.get('/:id/columns', columns.list);
router.post('/:id/columns', requireRole('admin'), columns.create);
router.put('/:id/columns/reorder', requireRole('admin'), columns.reorder);
router.put('/:id/columns/:columnId', requireRole('admin'), columns.update);
router.delete('/:id/columns/:columnId', requireRole('admin'), columns.remove);
```

Fix `loadProject` to import `Project` at top of the controller with the other models (do not inline require).

- [ ] **Step 4: Run tests**

```bash
cd back
npm test -- tests/routes/columns.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/columnsController.js back/src/routes/projects.js back/tests/routes/columns.test.js
git commit -m "$(cat <<'EOF'
feat: add per-project Kanban column API

EOF
)"
```

---

### Task 5: PATCH /tasks/:id/column and drop /status

**Files:**
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/src/routes/tasks.js`
- Modify: `back/tests/routes/tasks.test.js`
- Modify: `back/tests/routes/activities.test.js`

**Interfaces:**
- Consumes: `firstColumn`, `BoardColumn`.
- Produces: `PATCH /tasks/:id/column` body `{ columnId }`. Same auth as old status patch. Wrong project → 400 `{ error: 'Invalid column' }`. Same column → 200, no extra activity. Replace `updateStatus` export with `updateColumn`. Remove `PATCH /:id/status`. Create still uses first column if `req.body.columnId` omitted; if provided, column must belong to `projectId` else 400 `Invalid column`.

- [ ] **Step 1: Write the failing tests**

In `tasks.test.js` replace the two PATCH `/status` tests with:

```javascript
  it('assignee can PATCH the column of their task', async () => {
    const cols = await BoardColumn.findAll({ where: { projectId: project.id }, order: [['position', 'ASC']] });
    const inProgress = cols[1];
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/column`)
      .set('Cookie', developerCookie)
      .send({ columnId: inProgress.id });
    expect(res.status).toBe(200);
    expect(res.body.columnId).toBe(inProgress.id);
  });

  it('a different developer cannot PATCH the column of a task not assigned to them', async () => {
    const cols = await BoardColumn.findAll({ where: { projectId: project.id } });
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/column`)
      .set('Cookie', otherDeveloperCookie)
      .send({ columnId: cols[2].id });
    expect(res.status).toBe(403);
  });

  it('rejects a column from another project', async () => {
    const other = await Project.create({ name: 'Other board' });
    const [foreignCol] = await seedDefaultColumns(other.id);
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/column`)
      .set('Cookie', adminCookie)
      .send({ columnId: foreignCol.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid column' });
  });
```

Require `BoardColumn` and `seedDefaultColumns`. In `activities.test.js` PATCH `/column` with the In Progress column id; expect `toStatus: 'In Progress'`, `fromStatus: 'To Do'`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd back
npm test -- tests/routes/tasks.test.js tests/routes/activities.test.js
```

Expected: FAIL (404 on `/column`).

- [ ] **Step 3: Write minimal implementation**

`tasks.js`: `router.patch('/:id/column', controller.updateColumn);` and delete the `/status` line.

Replace `updateStatus` with `updateColumn` that reads `req.body.columnId`, loads `BoardColumn.findByPk`, checks `column.projectId === task.projectId`, then same transaction as Task 3's status updater using **names** from the column records. Export `updateColumn` instead of `updateStatus`.

`create`: if `req.body.columnId` is set, load that column and verify `projectId`; else `firstColumn`.

- [ ] **Step 4: Run tests**

```bash
cd back
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/tasksController.js back/src/routes/tasks.js back/tests/routes/tasks.test.js back/tests/routes/activities.test.js
git commit -m "$(cat <<'EOF'
feat: move tasks between columns via PATCH /tasks/:id/column

EOF
)"
```

---

### Task 6: Kanban tabs and columns from the API

**Files:**
- Create: `front/src/api/columns.js`
- Modify: `front/src/api/tasks.js`
- Modify: `front/src/pages/KanbanPage.jsx`
- Modify: `front/src/pages/KanbanPage.test.jsx`
- Modify: `front/src/components/kanban/KanbanColumn.jsx`

**Interfaces:**
- Consumes: `listColumns(projectId)`, `updateTaskColumn(id, columnId)`.
- Produces: Kanban has **tabs** (`role="tab"`) named with `project.name`, not a combobox. Active tab filters tasks by `projectId` and loads columns. Droppable id = `String(column.id)`. Cards grouped by `columnId`. `handleDragEnd` PATCHes `columnId` (optimistic). Member fetch still ignores stale responses. `Nueva tarea` stays to the right of the tab row.

- [ ] **Step 1: Write the failing tests**

Update `KanbanPage.test.jsx`: mock `listColumns` to the four defaults with ids 11–14. Tasks use `columnId` not `status`. Replace combobox tests with tabs:

```javascript
import * as columnsApi from '../api/columns';

// in grouping test:
vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([
  { id: 11, name: 'To Do', position: 0, projectId: 1 },
  { id: 12, name: 'In Progress', position: 1, projectId: 1 },
  { id: 13, name: 'Review', position: 2, projectId: 1 },
  { id: 14, name: 'Done', position: 3, projectId: 1 },
]);
// tasks: columnId 11, 12, 14 instead of status slugs

it('lets a developer pick a project via tabs', async () => {
  vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
  vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
    { id: 1, name: 'Project Alpha' },
    { id: 2, name: 'Project Beta' },
  ]);
  vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
  vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

  renderAs('developer');

  const alpha = await screen.findByRole('tab', { name: 'Project Alpha' });
  expect(alpha).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Project Beta' }));
  expect(screen.getByRole('tab', { name: 'Project Beta' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
});
```

Rewrite the members stale-response test to click tabs instead of `fireEvent.change(select)`. Rewrite the admin dropdown test the same way. Add `listColumns` mock to every test (return `[]` or the four columns).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd front
npx vitest run src/pages/KanbanPage.test.jsx
```

Expected: FAIL (combobox still there / no tabs).

- [ ] **Step 3: Write minimal implementation**

`front/src/api/columns.js`:

```javascript
import api from './client';

export async function listColumns(projectId) {
  const res = await api.get(`/projects/${projectId}/columns`);
  return res.data;
}

export async function createColumn(projectId, data) {
  const res = await api.post(`/projects/${projectId}/columns`, data);
  return res.data;
}

export async function updateColumn(projectId, columnId, data) {
  const res = await api.put(`/projects/${projectId}/columns/${columnId}`, data);
  return res.data;
}

export async function reorderColumns(projectId, columnIds) {
  const res = await api.put(`/projects/${projectId}/columns/reorder`, { columnIds });
  return res.data;
}

export async function deleteColumn(projectId, columnId) {
  await api.delete(`/projects/${projectId}/columns/${columnId}`);
}
```

`tasks.js` — replace `updateTaskStatus` with:

```javascript
export async function updateTaskColumn(id, columnId) {
  const res = await api.patch(`/tasks/${id}/column`, { columnId });
  return res.data;
}
```

`KanbanColumn.jsx` — props `{ column, tasks, canDragTask }` (no `COLUMN_LABELS`). Droppable `id: String(column.id)`. Header text `column.name`.

`KanbanPage.jsx` — state `columns`. When `selectedProjectId` changes, fetch `listColumns` with the same ignore flag as members. Render:

```jsx
<div className="mb-4 flex items-center gap-2">
  <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
    {projects.map((project) => (
      <button
        key={project.id}
        type="button"
        role="tab"
        aria-selected={String(selectedProjectId) === String(project.id)}
        onClick={() => setSelectedProjectId(String(project.id))}
        className={`shrink-0 rounded-md px-3 py-2 text-sm ${
          String(selectedProjectId) === String(project.id)
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground'
        }`}
      >
        {project.name}
      </button>
    ))}
  </div>
  {selectedProjectId && (
    <TaskFormModal projectId={selectedProjectId} users={members} onCreated={handleTaskCreated} />
  )}
</div>
```

Map `columns` into `KanbanColumn`. `handleDragEnd`: `newColumnId = Number(over.id)`; optimistic `columnId`; `updateTaskColumn(taskId, newColumnId)`.

Do **not** add + Columna / rename yet (Task 7).

- [ ] **Step 4: Run tests**

```bash
cd front
npx vitest run src/pages/KanbanPage.test.jsx
npx vitest run
```

Expected: PASS. Fix `TaskCard` if it still reads `task.status` for the dot — use `DOT.todo` fallback so Task 6 does not require `columnPosition` yet.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/columns.js front/src/api/tasks.js front/src/pages/KanbanPage.jsx front/src/pages/KanbanPage.test.jsx front/src/components/kanban/KanbanColumn.jsx
git commit -m "$(cat <<'EOF'
feat: switch Kanban projects with tabs and API columns

EOF
)"
```

---

### Task 7: Admin column chrome, dots, activity labels

**Files:**
- Modify: `front/src/components/kanban/KanbanColumn.jsx`
- Modify: `front/src/pages/KanbanPage.jsx`
- Modify: `front/src/pages/KanbanPage.test.jsx`
- Modify: `front/src/components/kanban/TaskCard.jsx`
- Modify: `front/src/components/kanban/TaskCard.test.jsx`
- Modify: `front/src/pages/TaskDetailPage.jsx`
- Modify: `front/src/pages/TaskDetailPage.test.jsx`

**Interfaces:**
- Consumes: `createColumn`, `updateColumn`, `deleteColumn`, `reorderColumns`, `useAuth`.
- Produces: Admin: click name to edit (Enter/blur → PUT), × only if `tasks.length === 0` (DELETE), header **drag handle** (`useSortable`) to reorder, ghost **+ Columna** with inline name field → POST. Developer: none of those. Failed rename/add: keep previous name, show `error` string. TaskCard dot: `['bg-muted-foreground','bg-primary','bg-rail','bg-teal-soft'][column.position % 4]`. Task detail: `Luis movió To Do → In Progress` using stored strings (drop `STATUS_LABELS`). Wrap columns in `SortableContext` + `DndContext`; `handleDragEnd` if `active.data.current.type === 'column'` then reorder, else move task.

- [ ] **Step 1: Write the failing tests**

In `KanbanPage.test.jsx` add (mock `listColumns` + empty tasks):

```javascript
  it('lets an admin add a column and hides that chrome from a developer', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([
      { id: 11, name: 'To Do', position: 0, projectId: 1 },
    ]);
    vi.spyOn(columnsApi, 'createColumn').mockResolvedValue({
      id: 15,
      name: 'Blocked',
      position: 1,
      projectId: 1,
    });

    renderAs('admin');
    expect(await screen.findByText('+ Columna')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Columna'));
    fireEvent.change(screen.getByLabelText('Nombre de columna'), { target: { value: 'Blocked' } });
    fireEvent.submit(screen.getByLabelText('Nombre de columna').closest('form'));
    await waitFor(() => expect(columnsApi.createColumn).toHaveBeenCalledWith('1', { name: 'Blocked' }));
    expect(await screen.findByText('Blocked')).toBeInTheDocument();
  });

  it('does not show + Columna to a developer', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([
      { id: 11, name: 'To Do', position: 0, projectId: 1 },
    ]);
    renderAs('developer');
    await screen.findByText('To Do');
    expect(screen.queryByText('+ Columna')).not.toBeInTheDocument();
  });
```

`TaskDetailPage.test.jsx`: activity already uses slugs `todo` / `in_progress` but the **new** UI shows stored strings as-is. Change the mock to `fromStatus: 'To Do', toStatus: 'In Progress'` and expect `Luis movió To Do → In Progress`. Remove `STATUS_LABELS`.

`TaskCard.test.jsx`: pass `columnPosition={0}`; still links.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd front
npx vitest run src/pages/KanbanPage.test.jsx src/pages/TaskDetailPage.test.jsx
```

Expected: FAIL (no `+ Columna`).

- [ ] **Step 3: Write minimal implementation**

Admin chrome on `KanbanColumn`: if `isAdmin`, the title is a button that swaps to `<input aria-label="Nombre de columna" />` for **rename** (distinct from the add form — use `aria-label={`Renombrar ${column.name}`}` for rename to avoid collisions). × `aria-label="Quitar columna"` when `tasks.length === 0`.

Ghost column on `KanbanPage` only if `user.role === 'admin' && selectedProjectId`: button `+ Columna` toggles a form with `aria-label="Nombre de columna"`.

Use `@dnd-kit/sortable`: `SortableContext` items=`columns.map(c => String(c.id))`. On the header, `useSortable({ id: String(column.id), data: { type: 'column' } })` and a handle button so card `useDraggable` stays on the card body.

`handleDragEnd`:

```javascript
if (active.data.current?.type === 'column' && over) {
  const oldIndex = columns.findIndex((c) => String(c.id) === String(active.id));
  const newIndex = columns.findIndex((c) => String(c.id) === String(over.id));
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
  const next = arrayMove(columns, oldIndex, newIndex);
  setColumns(next);
  try {
    await columnsApi.reorderColumns(selectedProjectId, next.map((c) => c.id));
  } catch {
    columnsApi.listColumns(selectedProjectId).then(setColumns);
  }
  return;
}
```

Pass `columnPosition={column.position}` into `TaskCard`. Dots:

```javascript
const DOTS = ['bg-muted-foreground', 'bg-primary', 'bg-rail', 'bg-teal-soft'];
const dot = DOTS[(columnPosition ?? 0) % DOTS.length];
```

`TaskDetailPage` `formatActivity` for `status_changed`: `` `${item.user.name} movió ${item.fromStatus} → ${item.toStatus}` ``.

On rename error, keep the previous name and render the `error` message from `err.response.data.error` if present.

- [ ] **Step 4: Run tests**

```bash
cd front
npx vitest run
cd ../back
npm test
```

Expected: PASS both suites.

- [ ] **Step 5: Commit**

```bash
git add front/src/components/kanban/KanbanColumn.jsx front/src/pages/KanbanPage.jsx front/src/pages/KanbanPage.test.jsx front/src/components/kanban/TaskCard.jsx front/src/components/kanban/TaskCard.test.jsx front/src/pages/TaskDetailPage.jsx front/src/pages/TaskDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: let admins edit Kanban columns on the board

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| BoardColumn model, unique name, positions, default four names | 1 |
| Seed on POST /projects | 2 |
| Task.columnId, drop status ENUM, activity STRING names, backfill | 3 |
| GET/POST/PUT/DELETE/reorder columns, exact errors, member GET, admin writes | 4 |
| PATCH /column, drop /status, first column on create, Invalid column | 5 |
| Tabs not combobox, columns from API, droppable column id | 6 |
| Admin inline rename/delete/reorder/+ Columna; developer read-only; dots by position; activity labels | 7 |
| Empty project list: no tabs / no + Columna | 6 (no projects → no tablist content, no ghost column without `selectedProjectId`) |
| Delete only if empty (409) | 4 |
| Do not change finance/features/notes/membership | all |
