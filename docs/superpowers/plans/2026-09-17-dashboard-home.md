# Operational Dashboard Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard tile menu with a home of work: four pulse counts plus one list of overdue/today tasks, due reminders, and paused projects, same layout for admin and developer.

**Architecture:** Add read-only `GET /dashboard` that assembles `{ pulse, items }` using an `America/Mexico_City` calendar-day window. The SPA `/` page drops navigation tiles and renders pulse cards plus a linked list. Kanban, notes CRUD, features, finance, and project status writes stay unchanged.

**Tech Stack:** Express, Sequelize (MySQL in prod, SQLite in tests), React, Vitest, Jest/supertest. No extra date library (`Intl` only).

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-17-dashboard-home-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. Same layout; role only changes which rows are included.
- Timezone is exactly `America/Mexico_City`. Calendar date = `YYYY-MM-DD` of the instant in that zone.
- Error bodies `{ error: string }`. No new error strings. 401 uses existing `Not authenticated` / `Invalid or expired token`. 500 uses existing `Internal server error`.
- Exact UI copy: `Vencidas y para hoy, más proyectos parados.`, `Vencidas`, `Hoy`, `Recordatorios`, `Parados`, `Tarea`, `Recordatorio`, `Feature`, `Parado`, `Nada vencido ni para hoy`, `No se pudo cargar`. Greeting stays `Hola, {name}`.
- Item fields exactly: `kind`, `id`, `title`, `at`, `bucket`, `projectId`, `projectName`, `taskId`. `kind` is `task` | `note_reminder` | `feature_reminder` | `project`. `bucket` is `overdue` | `today` | `paused`.
- Pulse is counted from the same `items` array. Reminder rows never increment `pulse.overdue` or `pulse.today`.
- TDD: failing test first. Commit after each task. Do not push.
- Do not implement on a dirty `master`. At execution time use `superpowers:using-git-worktrees` on a branch such as `feat/dashboard-home`.

## File map

| File | Role |
|---|---|
| `back/src/utils/dashboardWindow.js` | TZ, buckets, rightmost columns, sort, pulse, ISO `at` |
| `back/src/controllers/dashboardController.js` | Assemble `GET /dashboard` payload |
| `back/src/routes/dashboard.js` | `requireAuth` + `GET /` |
| `back/src/app.js` | Mount `/dashboard` |
| `front/src/api/dashboard.js` | `getDashboard()` |
| `front/src/lib/dashboardItemHref.js` | Item → path |
| `front/src/pages/DashboardPage.jsx` | Pulse + list; remove tiles |

---

### Task 1: Dashboard day-window helpers

**Files:**
- Create: `back/src/utils/dashboardWindow.js`
- Test: `back/tests/utils/dashboardWindow.test.js`

**Interfaces:**
- Consumes: nothing (pure helpers).
- Produces:
  - `DASHBOARD_TZ` = `'America/Mexico_City'`
  - `calendarDateInTz(date, timeZone?)` → `string | null` (`YYYY-MM-DD`)
  - `todayDateString(now)` → `string`
  - `taskBucket(dueDate, todayStr)` → `'overdue' | 'today' | null`
  - `reminderBucket(remindAt, notifiedAt, todayStr)` → `'overdue' | 'today' | null`
  - `rightmostColumnIds(columns)` → `Set<number>` (`columns` items have `id`, `projectId`, `position`)
  - `isoAt(value)` → `string | null` (`toISOString()`)
  - `sortDashboardItems(items)` → new array, spec sort tuple
  - `countPulse(items)` → `{ overdue, today, remindersToday, paused }`

- [ ] **Step 1: Write the failing tests**

Create `back/tests/utils/dashboardWindow.test.js`:

```javascript
const {
  DASHBOARD_TZ,
  calendarDateInTz,
  todayDateString,
  taskBucket,
  reminderBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
} = require('../../src/utils/dashboardWindow');

function mexicoNoon(ymd) {
  return new Date(`${ymd}T18:00:00.000Z`);
}

describe('dashboardWindow', () => {
  const today = '2026-09-17';
  const now = mexicoNoon(today);

  it('uses America/Mexico_City', () => {
    expect(DASHBOARD_TZ).toBe('America/Mexico_City');
  });

  it('maps noon UTC-6 to that calendar day', () => {
    expect(calendarDateInTz(now)).toBe(today);
    expect(todayDateString(now)).toBe(today);
  });

  it('maps early UTC morning to the previous CDMX day', () => {
    expect(calendarDateInTz(new Date('2026-09-17T05:00:00.000Z'))).toBe('2026-09-16');
  });

  it('buckets tasks overdue, today, and future/missing as null', () => {
    expect(taskBucket(mexicoNoon('2026-09-16'), today)).toBe('overdue');
    expect(taskBucket(mexicoNoon(today), today)).toBe('today');
    expect(taskBucket(mexicoNoon('2026-09-18'), today)).toBeNull();
    expect(taskBucket(null, today)).toBeNull();
  });

  it('includes overdue reminders only when not yet notified', () => {
    expect(reminderBucket(mexicoNoon('2026-09-16'), null, today)).toBe('overdue');
    expect(reminderBucket(mexicoNoon('2026-09-16'), now, today)).toBeNull();
  });

  it('includes today reminders even after notify', () => {
    expect(reminderBucket(mexicoNoon(today), now, today)).toBe('today');
    expect(reminderBucket(mexicoNoon(today), null, today)).toBe('today');
  });

  it('picks the rightmost column per project (position, then id)', () => {
    const ids = rightmostColumnIds([
      { id: 1, projectId: 10, position: 0 },
      { id: 2, projectId: 10, position: 3 },
      { id: 3, projectId: 10, position: 3 },
      { id: 4, projectId: 11, position: 1 },
    ]);
    expect([...ids].sort()).toEqual([3, 4]);
  });

  it('isoAt returns toISOString or null', () => {
    const d = mexicoNoon(today);
    expect(isoAt(d)).toBe(d.toISOString());
    expect(isoAt(null)).toBeNull();
  });

  it('sorts overdue tasks, today tasks, reminders, then paused projects', () => {
    const items = [
      { kind: 'project', id: 2, title: 'Zeta', at: null, bucket: 'paused', projectId: 2, projectName: 'Zeta', taskId: null },
      { kind: 'project', id: 1, title: 'Alfa', at: null, bucket: 'paused', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'feature_reminder', id: 8, title: 'F', at: mexicoNoon(today).toISOString(), bucket: 'today', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'note_reminder', id: 7, title: 'N', at: mexicoNoon(today).toISOString(), bucket: 'today', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'task', id: 5, title: 'T2', at: mexicoNoon(today).toISOString(), bucket: 'today', projectId: 1, projectName: 'Alfa', taskId: null },
      { kind: 'task', id: 4, title: 'T1', at: mexicoNoon('2026-09-10').toISOString(), bucket: 'overdue', projectId: 1, projectName: 'Alfa', taskId: null },
    ];
    expect(sortDashboardItems(items).map((i) => i.kind)).toEqual([
      'task',
      'task',
      'note_reminder',
      'feature_reminder',
      'project',
      'project',
    ]);
    expect(sortDashboardItems(items).filter((i) => i.kind === 'project').map((i) => i.projectName)).toEqual([
      'Alfa',
      'Zeta',
    ]);
  });

  it('counts pulse from items and keeps reminders out of task totals', () => {
    expect(
      countPulse([
        { kind: 'task', bucket: 'overdue' },
        { kind: 'task', bucket: 'today' },
        { kind: 'note_reminder', bucket: 'overdue' },
        { kind: 'feature_reminder', bucket: 'today' },
        { kind: 'project', bucket: 'paused' },
      ])
    ).toEqual({ overdue: 1, today: 1, remindersToday: 2, paused: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd back && npm test -- tests/utils/dashboardWindow.test.js
```

Expected: FAIL (cannot find module `dashboardWindow`).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/utils/dashboardWindow.js`:

```javascript
const DASHBOARD_TZ = 'America/Mexico_City';

function calendarDateInTz(date, timeZone = DASHBOARD_TZ) {
  if (date == null || date === '') return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function todayDateString(now) {
  return calendarDateInTz(now || new Date());
}

function taskBucket(dueDate, todayStr) {
  const day = calendarDateInTz(dueDate);
  if (!day) return null;
  if (day < todayStr) return 'overdue';
  if (day === todayStr) return 'today';
  return null;
}

function reminderBucket(remindAt, notifiedAt, todayStr) {
  const day = calendarDateInTz(remindAt);
  if (!day) return null;
  if (day === todayStr) return 'today';
  if (day < todayStr && notifiedAt == null) return 'overdue';
  return null;
}

function rightmostColumnIds(columns) {
  const best = new Map();
  for (const col of columns) {
    const prev = best.get(col.projectId);
    if (
      !prev
      || col.position > prev.position
      || (col.position === prev.position && col.id > prev.id)
    ) {
      best.set(col.projectId, col);
    }
  }
  return new Set([...best.values()].map((col) => col.id));
}

function isoAt(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function itemGroup(item) {
  if (item.kind === 'task' && item.bucket === 'overdue') return 0;
  if (item.kind === 'task' && item.bucket === 'today') return 1;
  if (item.kind === 'note_reminder' || item.kind === 'feature_reminder') return 2;
  return 3;
}

function kindOrder(kind) {
  if (kind === 'note_reminder') return 0;
  if (kind === 'feature_reminder') return 1;
  return 2;
}

function sortDashboardItems(items) {
  return [...items].sort((a, b) => {
    const group = itemGroup(a) - itemGroup(b);
    if (group) return group;
    const atA = a.at || '';
    const atB = b.at || '';
    if (atA !== atB) return atA < atB ? -1 : 1;
    if (itemGroup(a) === 2) {
      const kind = kindOrder(a.kind) - kindOrder(b.kind);
      if (kind) return kind;
    }
    if (itemGroup(a) === 3) {
      const name = String(a.projectName || '').localeCompare(String(b.projectName || ''), 'es');
      if (name) return name;
    }
    return a.id - b.id;
  });
}

function countPulse(items) {
  return {
    overdue: items.filter((item) => item.kind === 'task' && item.bucket === 'overdue').length,
    today: items.filter((item) => item.kind === 'task' && item.bucket === 'today').length,
    remindersToday: items.filter(
      (item) => item.kind === 'note_reminder' || item.kind === 'feature_reminder'
    ).length,
    paused: items.filter((item) => item.kind === 'project').length,
  };
}

module.exports = {
  DASHBOARD_TZ,
  calendarDateInTz,
  todayDateString,
  taskBucket,
  reminderBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
};
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd back && npm test -- tests/utils/dashboardWindow.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/utils/dashboardWindow.js back/tests/utils/dashboardWindow.test.js
git commit -m "$(cat <<'EOF'
feat: add Mexico City dashboard day-window helpers

EOF
)"
```

---

### Task 2: Mount empty `GET /dashboard`

**Files:**
- Create: `back/src/controllers/dashboardController.js`
- Create: `back/src/routes/dashboard.js`
- Modify: `back/src/app.js`
- Test: `back/tests/routes/dashboard.test.js`

**Interfaces:**
- Consumes: `requireAuth` from `back/src/middleware/auth.js` (same as notes).
- Produces: `GET /dashboard` → `200 { pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 }, items: [] }` when the user has nothing to show. `401` without cookie.

- [ ] **Step 1: Write the failing tests**

Create `back/tests/routes/dashboard.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

const EMPTY = {
  pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
  items: [],
};

describe('dashboard routes', () => {
  let otherCookie;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const other = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: 'x', role: 'developer' });
    otherCookie = `token=${signToken({ id: other.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not authenticated' });
  });

  it('returns an empty payload for a developer with no work', async () => {
    const res = await request(app).get('/dashboard').set('Cookie', otherCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY);
  });
});
```

If the file fails to load because `app` has no `/dashboard` yet, that is the expected fail.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js
```

Expected: FAIL (401 test may pass via global 404/401 depending on Express; the empty `GET /dashboard` should not return `200` with the empty pulse yet — typically 404). If 401 fails because the router 404s without hitting auth, that is still FAIL until mounted.

- [ ] **Step 3: Write minimal implementation**

Create `back/src/controllers/dashboardController.js`:

```javascript
async function list(req, res) {
  return res.json({
    pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
    items: [],
  });
}

module.exports = { list };
```

Create `back/src/routes/dashboard.js`:

```javascript
const express = require('express');
const controller = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', controller.list);

module.exports = router;
```

In `back/src/app.js`, add next to the other `app.use` route mounts:

```javascript
const dashboardRoutes = require('./routes/dashboard');
```

and:

```javascript
app.use('/dashboard', dashboardRoutes);
```

Place the mount after `app.use('/notes', notesRoutes);`.

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js
```

Expected: PASS (empty stub — later tasks fill the controller).

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/dashboardController.js back/src/routes/dashboard.js back/src/app.js back/tests/routes/dashboard.test.js
git commit -m "$(cat <<'EOF'
feat: mount an authenticated empty dashboard endpoint

EOF
)"
```

---

### Task 3: Dashboard task items

**Files:**
- Modify: `back/src/controllers/dashboardController.js`
- Test: `back/tests/routes/dashboard.test.js`

**Interfaces:**
- Consumes: `taskBucket`, `isoAt`, `rightmostColumnIds`, `sortDashboardItems`, `countPulse` from `dashboardWindow`; `Task` + `Project` + `BoardColumn`; `seedDefaultColumns`.
- Produces: `kind: 'task'` items for overdue/today dated tasks. Developer: `assigneeId = me` only. Admin: all assignees including `null`. Omit no-date, future, rightmost column, `oculto`, `archivado`.

- [ ] **Step 1: Write the failing tests**

Expand the imports and `beforeAll` of `back/tests/routes/dashboard.test.js` so later cases have users, dates, and a board helper. Keep the two tests from Task 2.

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');
const { todayDateString } = require('../../src/utils/dashboardWindow');

function mexicoNoon(ymd) {
  return new Date(`${ymd}T18:00:00.000Z`);
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const EMPTY = {
  pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
  items: [],
};

describe('dashboard routes', () => {
  let admin;
  let developer;
  let other;
  let adminCookie;
  let developerCookie;
  let otherCookie;
  let today;
  let yesterday;
  let tomorrow;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    other = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    otherCookie = `token=${signToken({ id: other.id, role: 'developer' })}`;
    today = todayDateString(new Date());
    yesterday = addDays(today, -1);
    tomorrow = addDays(today, 1);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  async function board(name, status = 'trabajando') {
    const project = await Project.create({ name, status });
    const cols = await seedDefaultColumns(project.id);
    return { project, todo: cols[0], done: cols[cols.length - 1] };
  }

  function taskItem(task, project, bucket) {
    return {
      kind: 'task',
      id: task.id,
      title: task.title,
      at: new Date(task.dueDate).toISOString(),
      bucket,
      projectId: project.id,
      projectName: project.name,
      taskId: null,
    };
  }

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not authenticated' });
  });

  it('returns an empty payload for a developer with no work', async () => {
    const res = await request(app).get('/dashboard').set('Cookie', otherCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY);
  });
```

Then append these two tests before the closing `});` of the describe:

```javascript
  it('lists the developer assigned overdue and today tasks and hides the rest', async () => {
    const { project, todo, done } = await board('Mine');
    await ProjectMember.create({ projectId: project.id, userId: developer.id });

    const overdue = await Task.create({
      projectId: project.id,
      title: 'Late',
      assigneeId: developer.id,
      columnId: todo.id,
      dueDate: mexicoNoon(yesterday),
    });
    const dueToday = await Task.create({
      projectId: project.id,
      title: 'Today',
      assigneeId: developer.id,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });
    await Task.create({
      projectId: project.id,
      title: 'No date',
      assigneeId: developer.id,
      columnId: todo.id,
    });
    await Task.create({
      projectId: project.id,
      title: 'Tomorrow',
      assigneeId: developer.id,
      columnId: todo.id,
      dueDate: mexicoNoon(tomorrow),
    });
    await Task.create({
      projectId: project.id,
      title: 'Done today',
      assigneeId: developer.id,
      columnId: done.id,
      dueDate: mexicoNoon(today),
    });
    await Task.create({
      projectId: project.id,
      title: 'Someone else',
      assigneeId: admin.id,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });
    await Task.create({
      projectId: project.id,
      title: 'Unassigned',
      assigneeId: null,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });

    const archived = await board('Old', 'archivado');
    await ProjectMember.create({ projectId: archived.project.id, userId: developer.id });
    await Task.create({
      projectId: archived.project.id,
      title: 'Archived task',
      assigneeId: developer.id,
      columnId: archived.todo.id,
      dueDate: mexicoNoon(today),
    });

    const res = await request(app).get('/dashboard').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      taskItem(overdue, project, 'overdue'),
      taskItem(dueToday, project, 'today'),
    ]);
    expect(res.body.pulse).toEqual({ overdue: 1, today: 1, remindersToday: 0, paused: 0 });
  });

  it('lets admin see unassigned and other people dated tasks', async () => {
    const { project, todo } = await board('Admin view');
    const unassigned = await Task.create({
      projectId: project.id,
      title: 'Open',
      assigneeId: null,
      columnId: todo.id,
      dueDate: mexicoNoon(today),
    });

    const res = await request(app).get('/dashboard').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.items.some((item) => item.id === unassigned.id && item.kind === 'task')).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js
```

Expected: FAIL (`items` still `[]`).

- [ ] **Step 3: Write minimal implementation**

Replace `back/src/controllers/dashboardController.js` with:

```javascript
const { Task, Project, BoardColumn } = require('../models');
const {
  todayDateString,
  taskBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
} = require('../utils/dashboardWindow');

function isHiddenStatus(status) {
  return status === 'oculto' || status === 'archivado';
}

async function list(req, res) {
  const today = todayDateString(new Date());
  const isAdmin = req.user.role === 'admin';
  const items = [];

  const columns = await BoardColumn.findAll();
  const doneColumnIds = rightmostColumnIds(columns);

  const taskWhere = {};
  if (!isAdmin) taskWhere.assigneeId = req.user.id;

  const tasks = await Task.findAll({
    where: taskWhere,
    include: [{ model: Project, as: 'project' }],
  });

  for (const task of tasks) {
    if (!task.project || isHiddenStatus(task.project.status)) continue;
    if (doneColumnIds.has(task.columnId)) continue;
    const bucket = taskBucket(task.dueDate, today);
    if (!bucket) continue;
    items.push({
      kind: 'task',
      id: task.id,
      title: task.title,
      at: isoAt(task.dueDate),
      bucket,
      projectId: task.projectId,
      projectName: task.project.name,
      taskId: null,
    });
  }

  const ordered = sortDashboardItems(items);
  return res.json({ pulse: countPulse(ordered), items: ordered });
}

module.exports = { list };
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/dashboardController.js back/tests/routes/dashboard.test.js
git commit -m "$(cat <<'EOF'
feat: include overdue and today tasks on the dashboard

EOF
)"
```

---

### Task 4: Dashboard reminder items

**Files:**
- Modify: `back/src/controllers/dashboardController.js`
- Test: `back/tests/routes/dashboard.test.js`

**Interfaces:**
- Consumes: `reminderBucket`; `Note` + `Feature` + `User` as `notifyUsers`; `NoteNotify` / `FeatureNotify`; note `task` include for project.
- Produces: `note_reminder` and `feature_reminder` items. Viewer must be owner/creator or in `notifyUsers` unless admin. Feature `status` does not matter. Hidden projects omitted. Standalone notes included.

- [ ] **Step 1: Write the failing tests**

Append inside the same `describe`:

```javascript
  it('lists note and feature reminders the developer owns or is notified of', async () => {
    const { project, todo } = await board('Reminders');
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    const linkedTask = await Task.create({
      projectId: project.id,
      title: 'Has note',
      assigneeId: developer.id,
      columnId: todo.id,
    });

    const owned = await Note.create({
      userId: developer.id,
      title: 'Call client',
      content: 'x',
      isReminder: true,
      remindAt: mexicoNoon(today),
    });
    const extra = await Note.create({
      userId: admin.id,
      title: 'Ping extra',
      content: 'x',
      projectId: project.id,
      isReminder: true,
      remindAt: mexicoNoon(today),
    });
    await NoteNotify.create({ noteId: extra.id, userId: developer.id });
    const taskNote = await Note.create({
      userId: developer.id,
      title: 'Task ping',
      content: 'x',
      taskId: linkedTask.id,
      isReminder: true,
      remindAt: mexicoNoon(yesterday),
    });
    await Note.create({
      userId: admin.id,
      title: 'Not for me',
      content: 'x',
      isReminder: true,
      remindAt: mexicoNoon(today),
    });
    await Note.create({
      userId: developer.id,
      title: 'Already mailed',
      content: 'x',
      isReminder: true,
      remindAt: mexicoNoon(yesterday),
      notifiedAt: mexicoNoon(yesterday),
    });

    const feature = await Feature.create({
      projectId: project.id,
      userId: admin.id,
      title: 'Ship SSO',
      isReminder: true,
      remindAt: mexicoNoon(today),
      status: 'done',
    });
    await FeatureNotify.create({ featureId: feature.id, userId: developer.id });

    const archived = await board('Archived reminders', 'archivado');
    await ProjectMember.create({ projectId: archived.project.id, userId: developer.id });
    await Note.create({
      userId: developer.id,
      title: 'Hidden note',
      content: 'x',
      projectId: archived.project.id,
      isReminder: true,
      remindAt: mexicoNoon(today),
    });

    const res = await request(app).get('/dashboard').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    const reminderTitles = res.body.items
      .filter((item) => item.kind === 'note_reminder' || item.kind === 'feature_reminder')
      .map((item) => item.title);
    expect(reminderTitles).toEqual(expect.arrayContaining([
      'Call client',
      'Ping extra',
      'Ship SSO',
      'Task ping',
    ]));
    expect(reminderTitles).not.toContain('Not for me');
    expect(reminderTitles).not.toContain('Already mailed');
    expect(reminderTitles).not.toContain('Hidden note');
    const standalone = res.body.items.find((item) => item.id === owned.id && item.kind === 'note_reminder');
    expect(standalone).toMatchObject({
      kind: 'note_reminder',
      projectId: null,
      projectName: null,
      taskId: null,
      bucket: 'today',
    });
    const fromTask = res.body.items.find((item) => item.id === taskNote.id && item.kind === 'note_reminder');
    expect(fromTask).toMatchObject({
      kind: 'note_reminder',
      projectId: project.id,
      projectName: project.name,
      taskId: linkedTask.id,
      bucket: 'overdue',
    });
    const feat = res.body.items.find((item) => item.kind === 'feature_reminder' && item.id === feature.id);
    expect(feat).toMatchObject({
      id: feature.id,
      title: 'Ship SSO',
      projectId: project.id,
      taskId: null,
      bucket: 'today',
    });
    expect(res.body.pulse.remindersToday).toBeGreaterThanOrEqual(4);
  });
```

Also add `Note`, `Feature`, `NoteNotify`, and `FeatureNotify` to the `require('../../src/models')` destructure at the top of this test file.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js
```

Expected: FAIL (no reminder kinds).

- [ ] **Step 3: Write minimal implementation**

Replace `back/src/controllers/dashboardController.js` with:

```javascript
const { Task, Project, BoardColumn, Note, Feature, User } = require('../models');
const {
  todayDateString,
  taskBucket,
  reminderBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
} = require('../utils/dashboardWindow');

function isHiddenStatus(status) {
  return status === 'oculto' || status === 'archivado';
}

function isRecipient(userId, ownerId, extras) {
  return ownerId === userId || (extras || []).some((person) => person.id === userId);
}

async function list(req, res) {
  const today = todayDateString(new Date());
  const isAdmin = req.user.role === 'admin';
  const items = [];

  const columns = await BoardColumn.findAll();
  const doneColumnIds = rightmostColumnIds(columns);

  const taskWhere = {};
  if (!isAdmin) taskWhere.assigneeId = req.user.id;

  const tasks = await Task.findAll({
    where: taskWhere,
    include: [{ model: Project, as: 'project' }],
  });

  for (const task of tasks) {
    if (!task.project || isHiddenStatus(task.project.status)) continue;
    if (doneColumnIds.has(task.columnId)) continue;
    const bucket = taskBucket(task.dueDate, today);
    if (!bucket) continue;
    items.push({
      kind: 'task',
      id: task.id,
      title: task.title,
      at: isoAt(task.dueDate),
      bucket,
      projectId: task.projectId,
      projectName: task.project.name,
      taskId: null,
    });
  }

  const notes = await Note.findAll({
    where: { isReminder: true },
    include: [
      { model: User, as: 'notifyUsers' },
      { model: Project, as: 'project' },
      { model: Task, as: 'task', include: [{ model: Project, as: 'project' }] },
    ],
  });

  for (const note of notes) {
    if (!isAdmin && !isRecipient(req.user.id, note.userId, note.notifyUsers)) continue;
    const bucket = reminderBucket(note.remindAt, note.notifiedAt, today);
    if (!bucket) continue;
    const project = note.project || (note.task && note.task.project) || null;
    if (project && isHiddenStatus(project.status)) continue;
    items.push({
      kind: 'note_reminder',
      id: note.id,
      title: note.title,
      at: isoAt(note.remindAt),
      bucket,
      projectId: project ? project.id : null,
      projectName: project ? project.name : null,
      taskId: note.taskId || null,
    });
  }

  const features = await Feature.findAll({
    where: { isReminder: true },
    include: [
      { model: User, as: 'notifyUsers' },
      { model: Project, as: 'project' },
    ],
  });

  for (const feature of features) {
    if (!isAdmin && !isRecipient(req.user.id, feature.userId, feature.notifyUsers)) continue;
    const bucket = reminderBucket(feature.remindAt, feature.notifiedAt, today);
    if (!bucket) continue;
    if (!feature.project || isHiddenStatus(feature.project.status)) continue;
    items.push({
      kind: 'feature_reminder',
      id: feature.id,
      title: feature.title,
      at: isoAt(feature.remindAt),
      bucket,
      projectId: feature.projectId,
      projectName: feature.project.name,
      taskId: null,
    });
  }

  const ordered = sortDashboardItems(items);
  return res.json({ pulse: countPulse(ordered), items: ordered });
}

module.exports = { list };
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/dashboardController.js back/tests/routes/dashboard.test.js
git commit -m "$(cat <<'EOF'
feat: include note and feature reminders on the dashboard

EOF
)"
```

---

### Task 5: Paused projects on the dashboard

**Files:**
- Modify: `back/src/controllers/dashboardController.js`
- Test: `back/tests/routes/dashboard.test.js`

**Interfaces:**
- Consumes: `memberProjectIds` from `back/src/utils/projectAccess.js`.
- Produces: `kind: 'project'` items with `bucket: 'paused'`, `at: null`, `projectId` = `id`, `projectName` = `title`. Developer: member + `parado` only. Admin: all `parado`. A dated task on a paused board still appears as a task **and** the project row.

- [ ] **Step 1: Write the failing tests**

Append:

```javascript
  it('lists paused projects for members and not for outsiders', async () => {
    const pausedMine = await Project.create({ name: 'Hold', status: 'parado' });
    await ProjectMember.create({ projectId: pausedMine.id, userId: developer.id });
    const pausedOther = await Project.create({ name: 'Other hold', status: 'parado' });
    await ProjectMember.create({ projectId: pausedOther.id, userId: other.id });

    const { project, todo } = await board('Paused work', 'parado');
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    const late = await Task.create({
      projectId: project.id,
      title: 'Still late',
      assigneeId: developer.id,
      columnId: todo.id,
      dueDate: mexicoNoon(yesterday),
    });

    const devRes = await request(app).get('/dashboard').set('Cookie', developerCookie);
    expect(devRes.status).toBe(200);
    const pausedNames = devRes.body.items.filter((item) => item.kind === 'project').map((item) => item.title);
    expect(pausedNames).toEqual(expect.arrayContaining(['Hold', 'Paused work']));
    expect(pausedNames).not.toContain('Other hold');
    expect(devRes.body.items.some((item) => item.kind === 'task' && item.id === late.id)).toBe(true);
    const hold = devRes.body.items.find((item) => item.title === 'Hold' && item.kind === 'project');
    expect(hold).toMatchObject({
      id: pausedMine.id,
      at: null,
      bucket: 'paused',
      projectId: pausedMine.id,
      projectName: 'Hold',
      taskId: null,
    });

    const adminRes = await request(app).get('/dashboard').set('Cookie', adminCookie);
    const adminPaused = adminRes.body.items.filter((item) => item.kind === 'project').map((item) => item.title);
    expect(adminPaused).toEqual(expect.arrayContaining(['Hold', 'Other hold', 'Paused work']));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js
```

Expected: FAIL (no `kind: 'project'` items).

- [ ] **Step 3: Write minimal implementation**

Replace `back/src/controllers/dashboardController.js` with:

```javascript
const { Task, Project, BoardColumn, Note, Feature, User } = require('../models');
const { memberProjectIds } = require('../utils/projectAccess');
const {
  todayDateString,
  taskBucket,
  reminderBucket,
  rightmostColumnIds,
  isoAt,
  sortDashboardItems,
  countPulse,
} = require('../utils/dashboardWindow');

function isHiddenStatus(status) {
  return status === 'oculto' || status === 'archivado';
}

function isRecipient(userId, ownerId, extras) {
  return ownerId === userId || (extras || []).some((person) => person.id === userId);
}

async function list(req, res) {
  const today = todayDateString(new Date());
  const isAdmin = req.user.role === 'admin';
  const items = [];

  const columns = await BoardColumn.findAll();
  const doneColumnIds = rightmostColumnIds(columns);

  const taskWhere = {};
  if (!isAdmin) taskWhere.assigneeId = req.user.id;

  const tasks = await Task.findAll({
    where: taskWhere,
    include: [{ model: Project, as: 'project' }],
  });

  for (const task of tasks) {
    if (!task.project || isHiddenStatus(task.project.status)) continue;
    if (doneColumnIds.has(task.columnId)) continue;
    const bucket = taskBucket(task.dueDate, today);
    if (!bucket) continue;
    items.push({
      kind: 'task',
      id: task.id,
      title: task.title,
      at: isoAt(task.dueDate),
      bucket,
      projectId: task.projectId,
      projectName: task.project.name,
      taskId: null,
    });
  }

  const notes = await Note.findAll({
    where: { isReminder: true },
    include: [
      { model: User, as: 'notifyUsers' },
      { model: Project, as: 'project' },
      { model: Task, as: 'task', include: [{ model: Project, as: 'project' }] },
    ],
  });

  for (const note of notes) {
    if (!isAdmin && !isRecipient(req.user.id, note.userId, note.notifyUsers)) continue;
    const bucket = reminderBucket(note.remindAt, note.notifiedAt, today);
    if (!bucket) continue;
    const project = note.project || (note.task && note.task.project) || null;
    if (project && isHiddenStatus(project.status)) continue;
    items.push({
      kind: 'note_reminder',
      id: note.id,
      title: note.title,
      at: isoAt(note.remindAt),
      bucket,
      projectId: project ? project.id : null,
      projectName: project ? project.name : null,
      taskId: note.taskId || null,
    });
  }

  const features = await Feature.findAll({
    where: { isReminder: true },
    include: [
      { model: User, as: 'notifyUsers' },
      { model: Project, as: 'project' },
    ],
  });

  for (const feature of features) {
    if (!isAdmin && !isRecipient(req.user.id, feature.userId, feature.notifyUsers)) continue;
    const bucket = reminderBucket(feature.remindAt, feature.notifiedAt, today);
    if (!bucket) continue;
    if (!feature.project || isHiddenStatus(feature.project.status)) continue;
    items.push({
      kind: 'feature_reminder',
      id: feature.id,
      title: feature.title,
      at: isoAt(feature.remindAt),
      bucket,
      projectId: feature.projectId,
      projectName: feature.project.name,
      taskId: null,
    });
  }

  let paused = [];
  if (isAdmin) {
    paused = await Project.findAll({ where: { status: 'parado' } });
  } else {
    const ids = await memberProjectIds(req.user.id);
    paused = ids.length
      ? await Project.findAll({ where: { id: ids, status: 'parado' } })
      : [];
  }

  for (const project of paused) {
    items.push({
      kind: 'project',
      id: project.id,
      title: project.name,
      at: null,
      bucket: 'paused',
      projectId: project.id,
      projectName: project.name,
      taskId: null,
    });
  }

  const ordered = sortDashboardItems(items);
  return res.json({ pulse: countPulse(ordered), items: ordered });
}

module.exports = { list };
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd back && npm test -- tests/routes/dashboard.test.js tests/utils/dashboardWindow.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/dashboardController.js back/tests/routes/dashboard.test.js
git commit -m "$(cat <<'EOF'
feat: list paused projects on the dashboard

EOF
)"
```

---

### Task 6: Dashboard item href helper

**Files:**
- Create: `front/src/lib/dashboardItemHref.js`
- Test: `front/src/lib/dashboardItemHref.test.js`

**Interfaces:**
- Consumes: dashboard item shape from the spec.
- Produces: `dashboardItemHref(item)` → string path as in the spec table.

- [ ] **Step 1: Write the failing test**

Create `front/src/lib/dashboardItemHref.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { dashboardItemHref } from './dashboardItemHref';

describe('dashboardItemHref', () => {
  it('routes each kind to the spec path', () => {
    expect(dashboardItemHref({ kind: 'task', id: 9, taskId: null, projectId: 1 })).toBe('/tasks/9');
    expect(dashboardItemHref({ kind: 'note_reminder', id: 3, taskId: 9, projectId: 1 })).toBe('/tasks/9');
    expect(dashboardItemHref({ kind: 'note_reminder', id: 3, taskId: null, projectId: 1 })).toBe('/projects/1');
    expect(dashboardItemHref({ kind: 'note_reminder', id: 3, taskId: null, projectId: null })).toBe('/notes');
    expect(dashboardItemHref({ kind: 'feature_reminder', id: 4, projectId: 1 })).toBe('/projects/1');
    expect(dashboardItemHref({ kind: 'project', id: 1, projectId: 1 })).toBe('/projects/1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd front && npm test -- src/lib/dashboardItemHref.test.js
```

Expected: FAIL (cannot find module).

- [ ] **Step 3: Write minimal implementation**

Create `front/src/lib/dashboardItemHref.js`:

```javascript
export function dashboardItemHref(item) {
  if (item.kind === 'task') return `/tasks/${item.id}`;
  if (item.kind === 'note_reminder') {
    if (item.taskId) return `/tasks/${item.taskId}`;
    if (item.projectId) return `/projects/${item.projectId}`;
    return '/notes';
  }
  if (item.kind === 'feature_reminder') return `/projects/${item.projectId}`;
  return `/projects/${item.id}`;
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd front && npm test -- src/lib/dashboardItemHref.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/lib/dashboardItemHref.js front/src/lib/dashboardItemHref.test.js
git commit -m "$(cat <<'EOF'
feat: map dashboard items to in-app paths

EOF
)"
```

---

### Task 7: Dashboard page pulse and list

**Files:**
- Create: `front/src/api/dashboard.js`
- Modify: `front/src/pages/DashboardPage.jsx`
- Modify: `front/src/pages/DashboardPage.test.jsx`

**Interfaces:**
- Consumes: `getDashboard()` → GET `/dashboard` via existing `api` client; `dashboardItemHref`; `StatusPill`; `PageSkeleton`; `EmptyState`; `Card`.
- Produces: home with greeting, exact subtitle, four pulse labels, list rows with exact type labels, empty/error/skeleton, no tiles.

- [ ] **Step 1: Write the failing tests**

Replace `front/src/pages/DashboardPage.test.jsx` with:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { AuthContext } from '../context/AuthContext';
import * as dashboardApi from '../api/dashboard';

vi.mock('../api/dashboard', () => ({
  getDashboard: vi.fn(),
}));

const empty = {
  pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
  items: [],
};

function renderDash(role = 'admin') {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    dashboardApi.getDashboard.mockReset();
    dashboardApi.getDashboard.mockResolvedValue(empty);
  });

  it('greets the user, shows pulse labels, and drops the old tiles', async () => {
    renderDash('admin');
    expect(screen.getByText('Hola, Ada')).toBeInTheDocument();
    expect(await screen.findByText('Vencidas y para hoy, más proyectos parados.')).toBeInTheDocument();
    expect(screen.getByText('Vencidas')).toBeInTheDocument();
    expect(screen.getByText('Hoy')).toBeInTheDocument();
    expect(screen.getByText('Recordatorios')).toBeInTheDocument();
    expect(screen.getByText('Parados')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Kanban/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
  });

  it('shows the empty copy when there is nothing due', async () => {
    renderDash('developer');
    expect(await screen.findByText('Nada vencido ni para hoy')).toBeInTheDocument();
  });

  it('shows an error when the request fails', async () => {
    dashboardApi.getDashboard.mockRejectedValueOnce(new Error('nope'));
    renderDash();
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument();
  });

  it('shows the loading skeleton while the request is pending', () => {
    dashboardApi.getDashboard.mockReturnValueOnce(new Promise(() => {}));
    renderDash();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('renders typed rows, overdue date styling, and paused pills', async () => {
    const overdueAt = '2026-09-10T18:00:00.000Z';
    dashboardApi.getDashboard.mockResolvedValueOnce({
      pulse: { overdue: 1, today: 0, remindersToday: 2, paused: 1 },
      items: [
        {
          kind: 'task',
          id: 1,
          title: 'Late task',
          at: overdueAt,
          bucket: 'overdue',
          projectId: 7,
          projectName: 'Acme',
          taskId: null,
        },
        {
          kind: 'note_reminder',
          id: 2,
          title: 'Call',
          at: '2026-09-17T18:00:00.000Z',
          bucket: 'today',
          projectId: null,
          projectName: null,
          taskId: null,
        },
        {
          kind: 'feature_reminder',
          id: 3,
          title: 'SSO',
          at: '2026-09-17T18:00:00.000Z',
          bucket: 'today',
          projectId: 7,
          projectName: 'Acme',
          taskId: null,
        },
        {
          kind: 'project',
          id: 7,
          title: 'Acme',
          at: null,
          bucket: 'paused',
          projectId: 7,
          projectName: 'Acme',
          taskId: null,
        },
      ],
    });

    renderDash();

    const late = await screen.findByRole('link', { name: 'Late task' });
    expect(late).toHaveAttribute('href', '/tasks/1');
    expect(screen.getByText('Tarea')).toBeInTheDocument();
    expect(screen.getByText('Recordatorio')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getAllByText('Parado').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', '/notes');
    expect(screen.getByRole('link', { name: 'SSO' })).toHaveAttribute('href', '/projects/7');
    expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/projects/7');

    const overdueDate = new Date(overdueAt).toLocaleDateString('es-MX');
    const dateEl = screen.getByText(overdueDate);
    expect(dateEl.className).toMatch(/text-destructive/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd front && npm test -- src/pages/DashboardPage.test.jsx
```

Expected: FAIL (tiles still present / `getDashboard` missing / old copy).

- [ ] **Step 3: Write minimal implementation**

Create `front/src/api/dashboard.js`:

```javascript
import api from './client';

export async function getDashboard() {
  const res = await api.get('/dashboard');
  return res.data;
}
```

Replace `front/src/pages/DashboardPage.jsx` with:

```javascript
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as dashboardApi from '../api/dashboard';
import { dashboardItemHref } from '../lib/dashboardItemHref';
import { Card, CardContent } from '@/components/ui/card';
import StatusPill from '../components/StatusPill';
import PageSkeleton from '../components/PageSkeleton';
import EmptyState from '../components/EmptyState';

const PULSE = [
  { key: 'overdue', label: 'Vencidas' },
  { key: 'today', label: 'Hoy' },
  { key: 'remindersToday', label: 'Recordatorios' },
  { key: 'paused', label: 'Parados' },
];

const TYPE_LABEL = {
  task: 'Tarea',
  note_reminder: 'Recordatorio',
  feature_reminder: 'Feature',
  project: 'Parado',
};

function itemDate(item) {
  if (!item.at) return null;
  return new Date(item.at).toLocaleDateString('es-MX');
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    dashboardApi
      .getDashboard()
      .then((payload) => {
        if (ignore) return;
        setData(payload);
        setError('');
      })
      .catch(() => {
        if (!ignore) setError('No se pudo cargar');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const pulse = data?.pulse || { overdue: 0, today: 0, remindersToday: 0, paused: 0 };
  const items = data?.items || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="font-heading text-2xl font-semibold">Hola, {user.name}</p>
        <p className="text-sm text-muted-foreground">Vencidas y para hoy, más proyectos parados.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PULSE.map((card) => (
          <Card key={card.key} className="shadow-card">
            <CardContent className="space-y-1 pt-0">
              <p className="font-heading text-2xl font-semibold">{pulse[card.key]}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent>
          {items.length === 0 ? (
            <EmptyState message="Nada vencido ni para hoy" />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const date = itemDate(item);
                return (
                  <li key={`${item.kind}-${item.id}`} className="py-3">
                    <Link
                      to={dashboardItemHref(item)}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.kind === 'project' ? (
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{TYPE_LABEL.project}</span>
                        <StatusPill status="parado" />
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span>{TYPE_LABEL[item.kind]}</span>
                        {item.projectName ? <span> · {item.projectName}</span> : null}
                        {date ? (
                          <>
                            <span> · </span>
                            <span className={item.bucket === 'overdue' ? 'text-destructive' : undefined}>
                              {date}
                            </span>
                          </>
                        ) : null}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd front && npm test -- src/pages/DashboardPage.test.jsx src/lib/dashboardItemHref.test.js
cd back && npm test -- tests/routes/dashboard.test.js tests/utils/dashboardWindow.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/dashboard.js front/src/pages/DashboardPage.jsx front/src/pages/DashboardPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: replace dashboard tiles with pulse counts and a work list

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| `GET /dashboard` + `requireAuth` + empty 200 | 2 |
| CDMX window, overdue/today buckets, notifiedAt | 1, 3, 4 |
| Rightmost column excluded | 1, 3 |
| oculto/archivado excluded | 3, 4 |
| Developer vs admin task/reminder/paused filters | 3, 4, 5 |
| Standalone note + extra notifyUsers + feature status ignored | 4 |
| Paused row + duplicate task on paused project | 5 |
| Pulse from items; reminders not in overdue/today | 1, 3, 4, 5 |
| Item shape and sort | 1, 3–5 |
| Exact UI copy, tiles gone, hrefs, empty/error/skeleton | 6, 7 |
| No new error strings; no pulse click filter; no polling | 2, 7 |
