# Project Status Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give projects four statuses (trabajando, parado, oculto, archivado) with admin-only change/delete, filtered lists, a frozen kanban when paused, and hard-delete with confirmation.

**Architecture:** Replace `Project.status` enum `active|archived` with the four values. Filter `GET /projects` for developers. Guard writes on paused projects in task/column controllers. Expand `DELETE /projects/:id` to cascade related rows. UI: StatusPill + select + delete dialog on list and detail; kanban hides oculto/archivado and disables drag/create when `parado`.

**Tech Stack:** Express, Sequelize (MySQL in prod, SQLite in tests), React, Vitest, Jest/supertest.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-15-project-status-lifecycle-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`.
- Error bodies `{ error: string }`. New exact strings: `Invalid status`, `Project is paused`. Keep existing strings.
- Status values exactly: `trabajando` | `parado` | `oculto` | `archivado`. Default `trabajando`.
- Exact UI copy: `Trabajando`, `Parado`, `Oculto`, `Archivado`, `Eliminar`, `Archivados`, `Cancelar`. Dialog: `¿Eliminar {nombre}? Se borran tareas, notas, features y finanzas.`
- Backfill: `active` → `trabajando`, `archived` → `archivado`.
- TDD: failing test first. Commit after each task. Do not push.
- Do not implement on a dirty `master`. At execution time use `superpowers:using-git-worktrees` on a branch such as `feat/project-status-lifecycle`.

## File map

| File | Role |
|---|---|
| `back/src/models/project.js` | Four-value enum |
| `back/src/utils/projectStatus.js` | Constants + `assertNotPaused` |
| `back/src/utils/ensureProjectStatuses.js` | MySQL enum + backfill |
| `back/src/server.js` | Call ensure after sync |
| `back/src/controllers/projectsController.js` | Filter list; validate PUT status; cascade delete |
| `back/src/controllers/tasksController.js` | 403 when paused (create + column patch) |
| `back/src/controllers/columnsController.js` | 403 when paused (create, reorder) |
| `front/src/lib/projectStatus.js` | Labels + kanban-visible helper |
| `front/src/components/StatusPill.jsx` | Four labels |
| `front/src/components/projects/ProjectStatusControls.jsx` | Select + delete dialog |
| `front/src/pages/ProjectsPage.jsx` | Split list; controls |
| `front/src/pages/ProjectDetailPage.jsx` | Controls; navigate after delete |
| `front/src/pages/KanbanPage.jsx` | Filter tabs; freeze parado |

---

### Task 1: Project status enum and MySQL backfill

**Files:**
- Modify: `back/src/models/project.js`
- Create: `back/src/utils/ensureProjectStatuses.js`
- Modify: `back/src/server.js`
- Test: `back/tests/models/project.test.js` (create if missing) and/or `back/tests/utils/ensureProjectStatuses.test.js`

**Interfaces:**
- Consumes: `sequelize.sync()` then ensure helper (same pattern as `ensureTaskActivityTypes`).
- Produces: `Project.status` default `trabajando`; allowed `trabajando|parado|oculto|archivado`. Helper `ensureProjectStatuses()`.

- [ ] **Step 1: Write the failing tests**

If `back/tests/models/project.test.js` does not exist, create it:

```javascript
process.env.JWT_SECRET = 'test-secret';
const { sequelize, Project } = require('../../src/models');

describe('Project status', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });
  afterAll(async () => {
    await sequelize.close();
  });

  it('defaults to trabajando', async () => {
    const p = await Project.create({ name: 'N' });
    expect(p.status).toBe('trabajando');
  });

  it('rejects an unknown status', async () => {
    await expect(Project.create({ name: 'N', status: 'active' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/models/project.test.js`

Expected: FAIL (`active` still accepted / default is `active`).

- [ ] **Step 3: Implement model + ensure**

`back/src/models/project.js` status:

```javascript
status: {
  type: DataTypes.ENUM('trabajando', 'parado', 'oculto', 'archivado'),
  allowNull: false,
  defaultValue: 'trabajando',
  validate: {
    isIn: {
      args: [['trabajando', 'parado', 'oculto', 'archivado']],
      msg: 'Invalid status',
    },
  },
},
```

`back/src/utils/ensureProjectStatuses.js` (MySQL only; SQLite tests use `sync({ force: true })`):

```javascript
const { sequelize } = require('../models');

async function ensureProjectStatuses() {
  if (sequelize.getDialect() !== 'mysql') return;
  await sequelize.query(
    "ALTER TABLE Projects MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'trabajando'"
  );
  await sequelize.query("UPDATE Projects SET status = 'trabajando' WHERE status = 'active'");
  await sequelize.query("UPDATE Projects SET status = 'archivado' WHERE status = 'archived'");
  await sequelize.query(
    "ALTER TABLE Projects MODIFY COLUMN status ENUM('trabajando','parado','oculto','archivado') NOT NULL DEFAULT 'trabajando'"
  );
}

module.exports = { ensureProjectStatuses };
```

Call `await ensureProjectStatuses()` in `server.js` immediately after `sequelize.sync()`, before other backfills.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/models/project.test.js && npm test -- tests/routes/projects.test.js`

Expected: model PASS. Existing `projects.test.js` PUT `{ status: 'archived' }` FAIL until Task 2 — if that suite fails on enum, update that one assertion in Task 2 only. For this task, change the existing PUT in `projects.test.js` from `'archived'` to `'archivado'` so the suite still runs (same meaning).

- [ ] **Step 5: Commit**

```bash
git add back/src/models/project.js back/src/utils/ensureProjectStatuses.js back/src/server.js back/tests/models/project.test.js back/tests/routes/projects.test.js
git commit -m "feat: replace project status with trabajando parado oculto archivado"
```

---

### Task 2: List filter and Invalid status on PUT

**Files:**
- Create: `back/src/utils/projectStatus.js`
- Modify: `back/src/controllers/projectsController.js`
- Test: `back/tests/routes/projects.test.js`

**Interfaces:**
- Consumes: `Project.status` four values.
- Produces: `PROJECT_STATUSES`, `isKanbanListed(status)` (`trabajando` or `parado`), `assertNotPaused(project, res)` → `false` after sending 403. `GET /projects` developer: member + `trabajando|parado` only. `PUT` invalid status → `400 { error: 'Invalid status' }`. Create JSON `status: 'trabajando'`.

- [ ] **Step 1: Write the failing tests**

Add to `back/tests/routes/projects.test.js`:

```javascript
it('admin create returns trabajando', async () => {
  const res = await request(app)
    .post('/projects')
    .set('Cookie', adminCookie)
    .send({ name: 'Fresh' });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe('trabajando');
});

it('rejects an invalid project status', async () => {
  const res = await request(app)
    .put(`/projects/${memberProject.id}`)
    .set('Cookie', adminCookie)
    .send({ status: 'active' });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Invalid status' });
});

it('hides oculto and archivado projects from a member developer', async () => {
  const hidden = await Project.create({ name: 'Ghost', status: 'oculto' });
  const parked = await Project.create({ name: 'Shelf', status: 'archivado' });
  await ProjectMember.create({ projectId: hidden.id, userId: developer.id });
  await ProjectMember.create({ projectId: parked.id, userId: developer.id });
  const res = await request(app).get('/projects').set('Cookie', developerCookie);
  expect(res.status).toBe(200);
  const names = res.body.map((p) => p.name);
  expect(names).not.toContain('Ghost');
  expect(names).not.toContain('Shelf');
  expect(names).toContain('Assigned Project');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/routes/projects.test.js`

Expected: FAIL (default still missing on create body if not asserted before; invalid status 200; developer still sees oculto).

- [ ] **Step 3: Implement**

`back/src/utils/projectStatus.js`:

```javascript
const PROJECT_STATUSES = ['trabajando', 'parado', 'oculto', 'archivado'];

function isKanbanListed(status) {
  return status === 'trabajando' || status === 'parado';
}

function assertNotPaused(project, res) {
  if (project.status === 'parado') {
    res.status(403).json({ error: 'Project is paused' });
    return false;
  }
  return true;
}

module.exports = { PROJECT_STATUSES, isKanbanListed, assertNotPaused };
```

`projectsController.list`: after resolving the admin/member query, if `req.user.role !== 'admin'` add `status: ['trabajando', 'parado']` to `where`.

`projectsController.update`:

```javascript
const { PROJECT_STATUSES } = require('../utils/projectStatus');
// ...
if (status !== undefined) {
  if (!PROJECT_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  project.status = status;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/routes/projects.test.js && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/utils/projectStatus.js back/src/controllers/projectsController.js back/tests/routes/projects.test.js
git commit -m "feat: filter developer projects and reject invalid status"
```

---

### Task 3: Freeze writes on a paused project

**Files:**
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/src/controllers/columnsController.js`
- Test: `back/tests/routes/tasks.test.js` and `back/tests/routes/columns.test.js`

**Interfaces:**
- Consumes: `assertNotPaused(project, res)` from `back/src/utils/projectStatus.js`.
- Produces: `POST /tasks`, `PATCH /tasks/:id/column`, `POST /projects/:id/columns`, `PUT /projects/:id/columns/reorder` return `403 { error: 'Project is paused' }` when `project.status === 'parado'`. Column **rename** and **delete** stay allowed (spec only blocks create/reorder and task create/move).

- [ ] **Step 1: Write the failing tests**

```javascript
it('rejects creating a task on a paused project', async () => {
  const paused = await Project.create({ name: 'Paused', status: 'parado' });
  await seedDefaultColumns(paused.id);
  const res = await request(app)
    .post('/tasks')
    .set('Cookie', adminCookie)
    .send({ projectId: paused.id, title: 'Nope' });
  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: 'Project is paused' });
});

it('rejects moving a task on a paused project', async () => {
  // create trabajando project + task, PUT status parado, PATCH column
  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: 'Project is paused' });
});
```

Same 403 for `POST /projects/:id/columns` and `PUT /projects/:id/columns/reorder` on a `parado` project.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/routes/tasks.test.js tests/routes/columns.test.js`

Expected: FAIL (201/200 instead of 403).

- [ ] **Step 3: Implement**

`tasksController.create`: after `Project.findByPk`, `if (!assertNotPaused(project, res)) return;`

`tasksController.updateColumn`: load task then `const project = await Project.findByPk(task.projectId); if (!assertNotPaused(project, res)) return;`

`columnsController.create` and `reorder`: after `loadProject`, `if (!assertNotPaused(project, res)) return;`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/routes/tasks.test.js tests/routes/columns.test.js && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/tasksController.js back/src/controllers/columnsController.js back/tests/routes/tasks.test.js back/tests/routes/columns.test.js
git commit -m "feat: block task and column writes on paused projects"
```

---

### Task 4: Hard-delete cascade

**Files:**
- Modify: `back/src/controllers/projectsController.js` `remove`
- Test: `back/tests/routes/projects.test.js`

**Interfaces:**
- Consumes: models `Note`, `NoteNotify`, `Feature`, `FeatureNotify`, `FinanceItem`, `ProjectMember`, `TaskActivity`, `Task`, `BoardColumn`, `Project`.
- Produces: `DELETE /projects/:id` 204 and zero leftover rows for that project (members, finance, features, notes on the project, notes on its tasks, activities, tasks, columns).

- [ ] **Step 1: Write the failing test**

Extend the doomed-project test (or add one) to also create a member, a project note, a feature, and a finance item; after DELETE assert each `count` is 0.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/routes/projects.test.js`

Expected: FAIL (FK / leftover rows) unless current destroy already cascades — then the test should still lock the behavior.

- [ ] **Step 3: Implement**

Inside the existing transaction, before `project.destroy`:

```javascript
const taskIds = (await Task.findAll({ where: { projectId: project.id }, attributes: ['id'], transaction: t })).map((row) => row.id);
if (taskIds.length) {
  const taskNotes = await Note.findAll({ where: { taskId: taskIds }, attributes: ['id'], transaction: t });
  const taskNoteIds = taskNotes.map((n) => n.id);
  if (taskNoteIds.length) await NoteNotify.destroy({ where: { noteId: taskNoteIds }, transaction: t });
  await Note.destroy({ where: { taskId: taskIds }, transaction: t });
  await TaskActivity.destroy({ where: { taskId: taskIds }, transaction: t });
}
const projectNotes = await Note.findAll({ where: { projectId: project.id }, attributes: ['id'], transaction: t });
const projectNoteIds = projectNotes.map((n) => n.id);
if (projectNoteIds.length) await NoteNotify.destroy({ where: { noteId: projectNoteIds }, transaction: t });
await Note.destroy({ where: { projectId: project.id }, transaction: t });
const features = await Feature.findAll({ where: { projectId: project.id }, attributes: ['id'], transaction: t });
const featureIds = features.map((f) => f.id);
if (featureIds.length) await FeatureNotify.destroy({ where: { featureId: featureIds }, transaction: t });
await Feature.destroy({ where: { projectId: project.id }, transaction: t });
await FinanceItem.destroy({ where: { projectId: project.id }, transaction: t });
await ProjectMember.destroy({ where: { projectId: project.id }, transaction: t });
await Task.destroy({ where: { projectId: project.id }, transaction: t });
await BoardColumn.destroy({ where: { projectId: project.id }, transaction: t });
await project.destroy({ transaction: t });
```

Do not add file-system cleanup unless an existing finance helper already deletes `storedName` files; if `financeController.remove` unlinks files, call the same helper per item. If it only drops DB rows, match that (YAGNI).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/routes/projects.test.js && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/projectsController.js back/tests/routes/projects.test.js
git commit -m "feat: cascade project delete across notes features finance and members"
```

---

### Task 5: StatusPill, list page, delete dialog

**Files:**
- Create: `front/src/lib/projectStatus.js`
- Create: `front/src/components/projects/ProjectStatusControls.jsx`
- Create: `front/src/components/projects/ProjectStatusControls.test.jsx`
- Modify: `front/src/components/StatusPill.jsx`
- Modify: `front/src/components/StatusPill.test.jsx`
- Modify: `front/src/pages/ProjectsPage.jsx`
- Modify: `front/src/pages/ProjectsPage.test.jsx`
- Modify: `front/src/pages/DashboardPage.jsx` description to `Proyectos por estado.` (optional one-liner so it is not “activos y archivados”).

**Interfaces:**
- Consumes: `updateProject(id, { status })`, `deleteProject(id)`.
- Produces: `PROJECT_STATUS_OPTIONS = [{ value, label }]` with the four Spanish labels. `ProjectStatusControls({ project, onUpdated, onDeleted })` for admin. Dialog copy exact.

- [ ] **Step 1: Write the failing tests**

`StatusPill.test.jsx`: `trabajando` → Trabajando, `parado` → Parado, `oculto` → Oculto, `archivado` → Archivado.

`ProjectsPage.test.jsx`: admin sees a combobox/select for a trabajando project and **Eliminar**; archived project appears after heading **Archivados**; developer does not see Eliminar or Archivados; choosing Parado calls `updateProject(1, { status: 'parado' })`; confirming delete calls `deleteProject(1)`.

`ProjectStatusControls.test.jsx`: click Eliminar shows `¿Eliminar Website Revamp? Se borran tareas, notas, features y finanzas.`; Cancelar does not call delete; Eliminar in the dialog does.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd front && npx vitest run src/components/StatusPill.test.jsx src/pages/ProjectsPage.test.jsx src/components/projects/ProjectStatusControls.test.jsx`

Expected: FAIL.

- [ ] **Step 3: Implement UI**

`front/src/lib/projectStatus.js`:

```javascript
export const PROJECT_STATUS_OPTIONS = [
  { value: 'trabajando', label: 'Trabajando' },
  { value: 'parado', label: 'Parado' },
  { value: 'oculto', label: 'Oculto' },
  { value: 'archivado', label: 'Archivado' },
];

export function isKanbanListed(status) {
  return status === 'trabajando' || status === 'parado';
}

export function statusLabel(status) {
  return PROJECT_STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}
```

StatusPill: render `statusLabel(status)`; keep teal for `trabajando`, muted for `archivado`/`oculto`, a distinct muted/amber-style class for `parado` using existing tokens (`bg-accent text-rail` is enough — no new palette).

ProjectStatusControls: `<select aria-label="Estado">` + Dialog for delete. Use the same Dialog primitives as `NoteFormModal`.

ProjectsPage: `openProjects = projects.filter((p) => p.status !== 'archivado')`, `archived = projects.filter((p) => p.status === 'archivado')`. Developer: only the open list, pill only.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd front && npx vitest run src/components/StatusPill.test.jsx src/pages/ProjectsPage.test.jsx src/components/projects/ProjectStatusControls.test.jsx && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/lib/projectStatus.js front/src/components/StatusPill.jsx front/src/components/StatusPill.test.jsx front/src/components/projects/ProjectStatusControls.jsx front/src/components/projects/ProjectStatusControls.test.jsx front/src/pages/ProjectsPage.jsx front/src/pages/ProjectsPage.test.jsx front/src/pages/DashboardPage.jsx
git commit -m "feat: let admins set project status and delete from the list"
```

---

### Task 6: Detail page status and delete

**Files:**
- Modify: `front/src/pages/ProjectDetailPage.jsx`
- Modify: `front/src/pages/ProjectDetailPage.test.jsx`

**Interfaces:**
- Consumes: `ProjectStatusControls`, `deleteProject`.
- Produces: admin sees controls next to the title; after delete, navigate to `/projects`. Developer does not see them. Developer loading an oculto project (not in `listProjects`) still shows `No se encontró`.

- [ ] **Step 1: Write the failing tests**

Admin fixture `{ id: 7, name: 'Website Revamp', status: 'trabajando' }`: `getByLabelText('Estado')` present; confirm delete calls `deleteProject(7)` and the router leaves `/projects/7` (assert `window.location` via MemoryRouter: after delete, render `/projects` route placeholder or `waitFor` `No se encontró` is wrong — add a sibling route:

```javascript
<Route path="/projects" element={<div>Lista</div>} />
<Route path="/projects/:id" element={<ProjectDetailPage />} />
```

After delete expect `Lista`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd front && npx vitest run src/pages/ProjectDetailPage.test.jsx`

Expected: FAIL (no Estado / no navigation).

- [ ] **Step 3: Implement**

Import `useNavigate`. Admin block:

```javascript
{user.role === 'admin' && (
  <ProjectStatusControls
    project={project}
    onUpdated={setProject}
    onDeleted={() => navigate('/projects')}
  />
)}
```

Place it beside the heading.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd front && npx vitest run src/pages/ProjectDetailPage.test.jsx && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/pages/ProjectDetailPage.jsx front/src/pages/ProjectDetailPage.test.jsx
git commit -m "feat: change project status and delete from the detail page"
```

---

### Task 7: Kanban tabs and paused freeze

**Files:**
- Modify: `front/src/pages/KanbanPage.jsx`
- Modify: `front/src/pages/KanbanPage.test.jsx`

**Interfaces:**
- Consumes: `isKanbanListed` from `front/src/lib/projectStatus.js`; `projects` from `GET /projects` (admin may receive oculto/archivado).
- Produces: tabs only `trabajando|parado`. If selected project is `parado`: `canDragTask` false; do not render `TaskFormModal` or `+ Columna`.

- [ ] **Step 1: Write the failing tests**

```javascript
it('does not show oculto or archivado projects as kanban tabs', async () => {
  vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([
    { id: 1, name: 'Live', status: 'trabajando' },
    { id: 2, name: 'Hidden', status: 'oculto' },
    { id: 3, name: 'Old', status: 'archivado' },
  ]);
  // members/columns/tasks empty mocks
  renderAs('admin');
  expect(await screen.findByRole('tab', { name: 'Live' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Hidden' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Old' })).not.toBeInTheDocument();
});

it('hides nueva tarea and column add when the project is parado', async () => {
  vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([
    { id: 1, name: 'Paused board', status: 'parado' },
  ]);
  renderAs('admin');
  expect(await screen.findByRole('tab', { name: 'Paused board' })).toBeInTheDocument();
  expect(screen.queryByText('Nueva tarea')).not.toBeInTheDocument();
  expect(screen.queryByText('+ Columna')).not.toBeInTheDocument();
});
```

Also: a task card on a parado board uses `cursor-default` even for admin (`canDragTask` false).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd front && npx vitest run src/pages/KanbanPage.test.jsx`

Expected: FAIL (all three names as tabs; Nueva tarea still shown).

- [ ] **Step 3: Implement**

```javascript
const boardProjects = projects.filter((p) => isKanbanListed(p.status));
const selectedProject = boardProjects.find((p) => String(p.id) === String(selectedProjectId));
const paused = selectedProject?.status === 'parado';
```

Use `boardProjects` for the tablist. `canDragTask`: if `paused` return false; else existing admin/assignee rule. Conditionally render `TaskFormModal` and `+ Columna` with `user.role === 'admin' && selectedProjectId && !paused`.

When `listProjects` returns and current `selectedProjectId` is oculto/archivado, reset selection to the first board project.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd front && npx vitest run src/pages/KanbanPage.test.jsx && npm test`

Expected: PASS, full frontend suite green.

- [ ] **Step 5: Commit**

```bash
git add front/src/pages/KanbanPage.jsx front/src/pages/KanbanPage.test.jsx
git commit -m "feat: hide archived projects on kanban and freeze paused boards"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|---|---|
| Four statuses + default trabajando | 1, 2 |
| Backfill active/archived | 1 |
| Developer GET filter | 2 |
| Invalid status 400 | 2 |
| Admin-only PUT/DELETE | already on routes; 2, 4 |
| Parado blocks create/move/column create+reorder | 3 |
| Hard delete cascade | 4 |
| List select + Archivados + Eliminar dialog | 5 |
| Detail controls + navigate | 6 |
| Kanban tabs + freeze | 7 |
| Copy strings | 5, 6 |
| Out of scope custom statuses / soft-delete | none |
