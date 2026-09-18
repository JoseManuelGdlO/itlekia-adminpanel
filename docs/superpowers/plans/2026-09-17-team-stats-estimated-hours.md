# Team Stats and Estimated Hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins an Equipo page of per-user project counts, Kanban task buckets, and summed estimated hours, and store optional hours on each task that only admins can see or edit.

**Architecture:** Pure `taskBuckets` helpers classify a column as todo/inProgress/done using leftmost/rightmost position (same tie-break as Dashboard). `Task.estimatedHours` is stripped from developer JSON. `GET /stats/team` (admin-only) assembles one row per user. The SPA adds `/team` plus hours inputs on create/detail.

**Tech Stack:** Express, Sequelize (MySQL in prod, SQLite in tests), React, Jest/supertest, Vitest. `sequelize.sync()` in tests; MySQL column added via `ensureTaskEstimatedHours`.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-17-team-stats-estimated-hours-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. Equipo and `GET /stats/team` are admin only (`403 { error: 'Forbidden' }`).
- Error bodies `{ error: string }`. Invalid hours: `400 { error: 'Invalid estimated hours' }`. 401 and 500 stay existing strings.
- Copy: nav `Equipo`; headers `Nombre`, `Proyectos`, `Por hacer`, `En curso`, `Hechas`, `Horas est.`; empty `Nadie en el equipo`; load error `No se pudo cargar`; field `Tiempo estimado (h)`.
- Member JSON keys exactly: `id`, `name`, `role`, `projects`, `todo`, `inProgress`, `done`, `estimatedHours`.
- Hours sum is todo + inProgress only. Unassigned tasks count for nobody. `oculto`/`archivado` never count.
- One-column board: all tasks `done`. Developer POST/PUT that includes `estimatedHours` is ignored.
- TDD. Commit after each task. Do not push.
- Do not implement on dirty `master`. At execution use `superpowers:using-git-worktrees` on `feat/team-stats-estimated-hours`. Copy or commit this spec/plan onto that branch first.

## File map

| File | Role |
|---|---|
| `back/src/utils/taskBuckets.js` | Leftmost/rightmost sets, `columnBucket` |
| `back/src/models/task.js` | `estimatedHours` |
| `back/src/utils/taskJson.js` | Parse hours + strip for developers |
| `back/src/utils/ensureTaskEstimatedHours.js` | MySQL ADD COLUMN |
| `back/src/controllers/statsController.js` | `GET /stats/team` |
| `front/src/pages/TeamPage.jsx` | Equipo table |
| `TaskFormModal` / `TaskDetailView` | Admin hours field |

---

### Task 1: Column buckets

**Files:**
- Create: `back/src/utils/taskBuckets.js`
- Test: `back/tests/utils/taskBuckets.test.js`

**Interfaces:**
- Consumes: `rightmostColumnIds` from `back/src/utils/dashboardWindow.js`.
- Produces:
  - `leftmostColumnIds(columns)` → `Set<number>` (`columns` items: `id`, `projectId`, `position`)
  - `columnBucket(columnId, columns)` → `'todo' | 'inProgress' | 'done'`

- [ ] **Step 1: Write the failing tests**

Create `back/tests/utils/taskBuckets.test.js`:

```javascript
const { leftmostColumnIds, columnBucket } = require('../../src/utils/taskBuckets');
const { rightmostColumnIds } = require('../../src/utils/dashboardWindow');

describe('taskBuckets', () => {
  it('picks leftmost by position then lowest id', () => {
    const ids = leftmostColumnIds([
      { id: 3, projectId: 10, position: 0 },
      { id: 1, projectId: 10, position: 0 },
      { id: 2, projectId: 10, position: 1 },
      { id: 9, projectId: 11, position: 2 },
    ]);
    expect([...ids].sort()).toEqual([1, 9]);
  });

  it('treats a one-column board as done', () => {
    const columns = [{ id: 5, projectId: 1, position: 0 }];
    expect(columnBucket(5, columns)).toBe('done');
    expect(rightmostColumnIds(columns).has(5)).toBe(true);
  });

  it('splits a two-column board into todo and done', () => {
    const columns = [
      { id: 1, projectId: 1, position: 0 },
      { id: 2, projectId: 1, position: 1 },
    ];
    expect(columnBucket(1, columns)).toBe('todo');
    expect(columnBucket(2, columns)).toBe('done');
  });

  it('marks middle columns inProgress', () => {
    const columns = [
      { id: 1, projectId: 1, position: 0 },
      { id: 2, projectId: 1, position: 1 },
      { id: 3, projectId: 1, position: 2 },
      { id: 4, projectId: 1, position: 3 },
    ];
    expect(columnBucket(1, columns)).toBe('todo');
    expect(columnBucket(2, columns)).toBe('inProgress');
    expect(columnBucket(3, columns)).toBe('inProgress');
    expect(columnBucket(4, columns)).toBe('done');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd back && npm test -- tests/utils/taskBuckets.test.js
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `back/src/utils/taskBuckets.js`:

```javascript
const { rightmostColumnIds } = require('./dashboardWindow');

function leftmostColumnIds(columns) {
  const best = new Map();
  for (const col of columns) {
    const prev = best.get(col.projectId);
    if (
      !prev
      || col.position < prev.position
      || (col.position === prev.position && col.id < prev.id)
    ) {
      best.set(col.projectId, col);
    }
  }
  return new Set([...best.values()].map((col) => col.id));
}

function columnBucket(columnId, columns) {
  const id = Number(columnId);
  const right = rightmostColumnIds(columns);
  if (right.has(id)) return 'done';
  const left = leftmostColumnIds(columns);
  if (left.has(id)) return 'todo';
  return 'inProgress';
}

module.exports = { leftmostColumnIds, columnBucket };
```

- [ ] **Step 4: Run tests and make sure they pass**

```bash
cd back && npm test -- tests/utils/taskBuckets.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/utils/taskBuckets.js back/tests/utils/taskBuckets.test.js
git commit -m "$(cat <<'EOF'
feat: classify kanban columns into todo, in-progress, and done

EOF
)"
```

---

### Task 2: `estimatedHours` on tasks (API)

**Files:**
- Modify: `back/src/models/task.js`
- Create: `back/src/utils/taskJson.js`
- Create: `back/src/utils/ensureTaskEstimatedHours.js`
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/src/server.js`
- Test: `back/tests/routes/tasks.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `parseEstimatedHours(raw)` → `{ skip: true }` | `{ value: number | null }` | `{ error: 'Invalid estimated hours' }`
  - `toPublicTask(task, user)` → plain object; omits `estimatedHours` unless `user.role === 'admin'` (admin gets `null` or `Number`)
  - `Task.estimatedHours` nullable DECIMAL

- [ ] **Step 1: Write the failing tests**

In `back/tests/routes/tasks.test.js`, after the existing create tests, append:

```javascript
  it('admin create and get include estimatedHours', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Timed', estimatedHours: 2.5 });
    expect(res.status).toBe(201);
    expect(res.body.estimatedHours).toBe(2.5);
    const listed = await request(app).get('/tasks').set('Cookie', adminCookie);
    const row = listed.body.find((t) => t.id === res.body.id);
    expect(row.estimatedHours).toBe(2.5);
  });

  it('developer create and list omit estimatedHours', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: project.id, title: 'Dev task', estimatedHours: 9 });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('estimatedHours');
    const listed = await request(app)
      .get(`/tasks?projectId=${project.id}`)
      .set('Cookie', developerCookie);
    listed.body.forEach((t) => expect(t).not.toHaveProperty('estimatedHours'));
    const stored = await Task.findOne({ where: { title: 'Dev task' } });
    expect(stored.estimatedHours).toBeNull();
  });

  it('developer PUT cannot overwrite estimatedHours', async () => {
    const timed = await Task.create({
      projectId: project.id,
      title: 'Keep hours',
      columnId: todoCol.id,
      assigneeId: developer.id,
      estimatedHours: 4,
    });
    const res = await request(app)
      .put(`/tasks/${timed.id}`)
      .set('Cookie', developerCookie)
      .send({ description: '<p>Hi</p>', estimatedHours: 99 });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('estimatedHours');
    await timed.reload();
    expect(Number(timed.estimatedHours)).toBe(4);
  });

  it('rejects negative estimatedHours', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Bad hours', estimatedHours: -1 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid estimated hours' });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd back && npm test -- tests/routes/tasks.test.js
```

Expected: FAIL (`estimatedHours` not a column / not in JSON).

- [ ] **Step 3: Implement**

`back/src/models/task.js` — add:

```javascript
estimatedHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: null },
```

Create `back/src/utils/taskJson.js`:

```javascript
function parseEstimatedHours(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: 'Invalid estimated hours' };
  return { value: n };
}

function toPublicTask(task, user) {
  const json = typeof task.toJSON === 'function' ? task.toJSON() : { ...task };
  if (user.role !== 'admin') {
    delete json.estimatedHours;
    return json;
  }
  json.estimatedHours = json.estimatedHours == null ? null : Number(json.estimatedHours);
  return json;
}

module.exports = { parseEstimatedHours, toPublicTask };
```

In `tasksController.js`:

```javascript
const { parseEstimatedHours, toPublicTask } = require('../utils/taskJson');
```

`list`: `return res.json(tasks.map((task) => toPublicTask(task, req.user)));`

`create`: after pause/assignee/description checks, before the transaction:

```javascript
  let hours = null;
  if (req.user.role === 'admin') {
    const parsed = parseEstimatedHours(req.body.estimatedHours);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!parsed.skip) hours = parsed.value;
  }
```

Pass `estimatedHours: hours` into `Task.create`. Return `res.status(201).json(toPublicTask(task, req.user))`.

`update`: after the admin field block (or inside it), apply hours only for admin:

```javascript
  if (req.user.role === 'admin' && req.body.estimatedHours !== undefined) {
    const parsed = parseEstimatedHours(req.body.estimatedHours);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!parsed.skip) task.estimatedHours = parsed.value;
  }
```

All `res.json(task)` in this file that return a Task instance (`update`, `updateColumn`) must use `toPublicTask(task, req.user)`.

Create `back/src/utils/ensureTaskEstimatedHours.js`:

```javascript
const { sequelize } = require('../models');

async function ensureTaskEstimatedHours() {
  if (sequelize.getDialect() !== 'mysql') return;
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'estimatedHours'`
  );
  if (rows.length) return;
  await sequelize.query('ALTER TABLE Tasks ADD COLUMN estimatedHours DECIMAL(10,2) NULL');
}

module.exports = { ensureTaskEstimatedHours };
```

In `back/src/server.js`, after `sequelize.sync()`:

```javascript
const { ensureTaskEstimatedHours } = require('./utils/ensureTaskEstimatedHours');
// ...
  await ensureTaskEstimatedHours();
```

- [ ] **Step 4: Run tests and make sure they pass**

```bash
cd back && npm test -- tests/routes/tasks.test.js
```

Expected: PASS (including existing cases).

- [ ] **Step 5: Commit**

```bash
git add back/src/models/task.js back/src/utils/taskJson.js back/src/utils/ensureTaskEstimatedHours.js back/src/controllers/tasksController.js back/src/server.js back/tests/routes/tasks.test.js
git commit -m "$(cat <<'EOF'
feat: store admin-only estimated hours on tasks

EOF
)"
```

---

### Task 3: `GET /stats/team`

**Files:**
- Create: `back/src/controllers/statsController.js`
- Create: `back/src/routes/stats.js`
- Modify: `back/src/app.js`
- Test: `back/tests/routes/stats.test.js`

**Interfaces:**
- Consumes: `columnBucket` from Task 1; `Task.estimatedHours` from Task 2; `isKanbanListed` from `back/src/utils/projectStatus.js`.
- Produces: `GET /stats/team` → `{ members: Array<{ id, name, role, projects, todo, inProgress, done, estimatedHours }> }`

- [ ] **Step 1: Write the failing tests**

Create `back/tests/routes/stats.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const {
  sequelize,
  User,
  Project,
  ProjectMember,
  Task,
  BoardColumn,
} = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');
const { seedDefaultColumns } = require('../../src/utils/boardColumns');

describe('stats team', () => {
  let admin;
  let developer;
  let adminCookie;
  let developerCookie;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    admin = await User.create({ name: 'Ada', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('developer is forbidden', async () => {
    const res = await request(app).get('/stats/team').set('Cookie', developerCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('lists admin and developer with membership, buckets, and open hours', async () => {
    const live = await Project.create({ name: 'Live', status: 'trabajando' });
    const paused = await Project.create({ name: 'Hold', status: 'parado' });
    const archived = await Project.create({ name: 'Old', status: 'archivado' });
    const hidden = await Project.create({ name: 'Hidden', status: 'oculto' });
    const [todo, doing, review, done] = await seedDefaultColumns(live.id);
    const [pausedTodo] = await seedDefaultColumns(paused.id);
    const [archTodo] = await seedDefaultColumns(archived.id);
    const [hidTodo] = await seedDefaultColumns(hidden.id);
    await ProjectMember.create({ projectId: live.id, userId: developer.id });
    await ProjectMember.create({ projectId: paused.id, userId: developer.id });
    await ProjectMember.create({ projectId: archived.id, userId: developer.id });
    await Task.create({
      projectId: live.id, title: 'Todo', columnId: todo.id, assigneeId: developer.id, estimatedHours: 2.5,
    });
    await Task.create({
      projectId: live.id, title: 'Doing', columnId: doing.id, assigneeId: developer.id, estimatedHours: null,
    });
    await Task.create({
      projectId: live.id, title: 'Review', columnId: review.id, assigneeId: developer.id, estimatedHours: 1,
    });
    await Task.create({
      projectId: live.id, title: 'Done', columnId: done.id, assigneeId: developer.id, estimatedHours: 10,
    });
    await Task.create({
      projectId: live.id, title: 'Unassigned', columnId: todo.id, assigneeId: null, estimatedHours: 8,
    });
    await Task.create({
      projectId: hidden.id, title: 'Hidden work', columnId: hidTodo.id, assigneeId: developer.id, estimatedHours: 3,
    });
    await Task.create({
      projectId: archived.id, title: 'Old work', columnId: archTodo.id, assigneeId: developer.id,
    });
    await Task.create({
      projectId: paused.id, title: 'Paused todo', columnId: pausedTodo.id, assigneeId: developer.id, estimatedHours: 0.5,
    });

    const res = await request(app).get('/stats/team').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.members.map((m) => m.id)).toEqual([admin.id, developer.id]);
    const ada = res.body.members[0];
    expect(ada).toEqual({
      id: admin.id,
      name: 'Ada',
      role: 'admin',
      projects: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      estimatedHours: 0,
    });
    const dev = res.body.members[1];
    expect(dev).toEqual({
      id: developer.id,
      name: 'Dev',
      role: 'developer',
      projects: 2,
      todo: 2,
      inProgress: 2,
      done: 1,
      estimatedHours: 4,
    });
  });

  it('returns empty members when there are no users', async () => {
    await User.destroy({ where: {} });
    const res = await request(app).get('/stats/team').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ members: [] });
  });
});
```

Hours math: todo 2.5 + doing null + review 1 (inProgress) + paused todo 0.5 = 4. Done 10 and hidden/archived/unassigned excluded. todo count: Live todo + Paused todo = 2. inProgress: doing + review = 2. done: 1.

Name sort: Ada then Dev.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd back && npm test -- tests/routes/stats.test.js
```

Expected: FAIL (404, `/stats` not mounted).

- [ ] **Step 3: Implement**

`back/src/controllers/statsController.js`:

```javascript
const { User, Project, ProjectMember, Task, BoardColumn } = require('../models');
const { isKanbanListed } = require('../utils/projectStatus');
const { columnBucket } = require('../utils/taskBuckets');

async function team(req, res) {
  const users = await User.findAll({ order: [['name', 'ASC'], ['id', 'ASC']] });
  const projects = await Project.findAll();
  const listed = projects.filter((p) => isKanbanListed(p.status));
  const listedIds = listed.map((p) => p.id);
  const members = await ProjectMember.findAll({ where: { projectId: listedIds } });
  const columns = listedIds.length
    ? await BoardColumn.findAll({ where: { projectId: listedIds } })
    : [];
  const tasks = listedIds.length
    ? await Task.findAll({ where: { projectId: listedIds } })
    : [];

  const projectCount = new Map();
  for (const row of members) {
    projectCount.set(row.userId, (projectCount.get(row.userId) || 0) + 1);
  }

  const buckets = new Map();
  for (const user of users) {
    buckets.set(user.id, { todo: 0, inProgress: 0, done: 0, estimatedHours: 0 });
  }
  for (const task of tasks) {
    if (task.assigneeId == null) continue;
    const slot = buckets.get(task.assigneeId);
    if (!slot) continue;
    const bucket = columnBucket(task.columnId, columns);
    slot[bucket] += 1;
    if (bucket !== 'done') {
      slot.estimatedHours += Number(task.estimatedHours || 0);
    }
  }

  return res.json({
    members: users.map((user) => {
      const slot = buckets.get(user.id);
      return {
        id: user.id,
        name: user.name,
        role: user.role,
        projects: projectCount.get(user.id) || 0,
        todo: slot.todo,
        inProgress: slot.inProgress,
        done: slot.done,
        estimatedHours: slot.estimatedHours,
      };
    }),
  });
}

module.exports = { team };
```

`back/src/routes/stats.js`:

```javascript
const express = require('express');
const controller = require('../controllers/statsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/team', controller.team);
module.exports = router;
```

In `back/src/app.js`:

```javascript
const statsRoutes = require('./routes/stats');
app.use('/stats', statsRoutes);
```

Place the mount next to `/dashboard`.

- [ ] **Step 4: Run tests and make sure they pass**

```bash
cd back && npm test -- tests/routes/stats.test.js tests/utils/taskBuckets.test.js tests/routes/tasks.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/statsController.js back/src/routes/stats.js back/src/app.js back/tests/routes/stats.test.js
git commit -m "$(cat <<'EOF'
feat: add admin team stats endpoint

EOF
)"
```

---

### Task 4: Equipo page and nav

**Files:**
- Create: `front/src/api/stats.js`
- Create: `front/src/pages/TeamPage.jsx`
- Create: `front/src/pages/TeamPage.test.jsx`
- Modify: `front/src/App.jsx`
- Modify: `front/src/components/AppShell.jsx`
- Modify: `front/src/components/AppShell.test.jsx`

**Interfaces:**
- Consumes: `getTeamStats()` → `{ members }` from Task 3.
- Produces: `/team` admin route; nav label `Equipo`.

- [ ] **Step 1: Write the failing tests**

Create `front/src/pages/TeamPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TeamPage from './TeamPage';
import * as statsApi from '../api/stats';

describe('TeamPage', () => {
  it('renders member rows and headers', async () => {
    vi.spyOn(statsApi, 'getTeamStats').mockResolvedValueOnce({
      members: [
        {
          id: 2,
          name: 'Dev',
          role: 'developer',
          projects: 2,
          todo: 1,
          inProgress: 3,
          done: 4,
          estimatedHours: 6.5,
        },
      ],
    });
    render(<TeamPage />);
    expect(await screen.findByText('Dev')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Por hacer')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Hechas')).toBeInTheDocument();
    expect(screen.getByText('Horas est.')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
  });

  it('shows Nadie en el equipo when members is empty', async () => {
    vi.spyOn(statsApi, 'getTeamStats').mockResolvedValueOnce({ members: [] });
    render(<TeamPage />);
    expect(await screen.findByText('Nadie en el equipo')).toBeInTheDocument();
  });

  it('shows No se pudo cargar on failure', async () => {
    vi.spyOn(statsApi, 'getTeamStats').mockRejectedValueOnce(new Error('nope'));
    render(<TeamPage />);
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument();
  });
});
```

In `front/src/components/AppShell.test.jsx` add:

```jsx
  it('shows the Equipo link for admins between Proyectos and Usuarios', () => {
    renderWithUser('admin');
    expect(screen.getByRole('link', { name: 'Equipo' })).toBeInTheDocument();
  });

  it('hides the Equipo link for developers', () => {
    renderWithUser('developer');
    expect(screen.queryByRole('link', { name: 'Equipo' })).not.toBeInTheDocument();
  });
```

In the expanded-rail test, also `expect(screen.getByText('Equipo')).toBeInTheDocument();`.

Add a title test:

```jsx
  it('sets the top-bar title Equipo', () => {
    renderWithUser('admin', { path: '/team' });
    expect(screen.getByRole('heading', { level: 1, name: 'Equipo' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd front && npm test -- src/pages/TeamPage.test.jsx src/components/AppShell.test.jsx
```

Expected: FAIL (page/module missing; Equipo link missing).

- [ ] **Step 3: Implement**

`front/src/api/stats.js`:

```javascript
import api from './client';

export async function getTeamStats() {
  const res = await api.get('/stats/team');
  return res.data;
}
```

`front/src/pages/TeamPage.jsx`:

```jsx
import { useEffect, useState } from 'react';
import * as statsApi from '../api/stats';
import { Card, CardContent } from '@/components/ui/card';
import PageSkeleton from '../components/PageSkeleton';
import EmptyState from '../components/EmptyState';

export default function TeamPage() {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    statsApi
      .getTeamStats()
      .then((payload) => {
        if (ignore) return;
        setMembers(payload.members || []);
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

  if (loading) {
    return (
      <div className="p-6">
        <PageSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }
  if (!members.length) {
    return (
      <div className="p-6">
        <EmptyState message="Nadie en el equipo" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="shadow-card">
        <CardContent>
          <table className="w-full text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2">
            <thead className="bg-background text-left text-xs text-muted-foreground">
              <tr>
                <th>Nombre</th>
                <th>Proyectos</th>
                <th>Por hacer</th>
                <th>En curso</th>
                <th>Hechas</th>
                <th>Horas est.</th>
              </tr>
            </thead>
            <tbody>
              {members.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td>{row.name}</td>
                  <td>{row.projects}</td>
                  <td>{row.todo}</td>
                  <td>{row.inProgress}</td>
                  <td>{row.done}</td>
                  <td>{row.estimatedHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

`App.jsx`: import `TeamPage`, add

```jsx
<Route path="/team" element={<AuthenticatedLayout role="admin"><TeamPage /></AuthenticatedLayout>} />
```

`AppShell.jsx`: import `ChartColumn` from `lucide-react`. In `NAV_ITEMS` insert after Proyectos:

```javascript
  { to: '/team', label: 'Equipo', icon: ChartColumn, roles: ['admin'] },
```

In `pageTitle` titles: `'/team': 'Equipo'`.

- [ ] **Step 4: Run tests and make sure they pass**

```bash
cd front && npm test -- src/pages/TeamPage.test.jsx src/components/AppShell.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/stats.js front/src/pages/TeamPage.jsx front/src/pages/TeamPage.test.jsx front/src/App.jsx front/src/components/AppShell.jsx front/src/components/AppShell.test.jsx
git commit -m "$(cat <<'EOF'
feat: add admin Equipo stats page

EOF
)"
```

---

### Task 5: Admin hours field on create and detail

**Files:**
- Modify: `front/src/components/kanban/TaskFormModal.jsx`
- Modify: `front/src/components/kanban/TaskFormModal.test.jsx`
- Modify: `front/src/components/tasks/TaskDetailView.jsx`
- Modify: `front/src/components/tasks/TaskDetailView.test.jsx`

**Interfaces:**
- Consumes: `createTask` / `updateTask`; `user.role` via `useAuth()` (`const { user } = useAuth() || {}`).
- Produces: admin-only `Tiempo estimado (h)` input; create POST includes `estimatedHours`; detail PUT on change.

- [ ] **Step 1: Write the failing tests**

In `TaskFormModal.test.jsx`, wrap renders that need a user with:

```jsx
import { AuthContext } from '../../context/AuthContext';

function renderForm(role, props = {}) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, role }, loading: false }}>
      <TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} {...props} />
    </AuthContext.Provider>
  );
}
```

Keep existing tests working: `useAuth() || {}` so a missing provider does not crash. Add:

```jsx
  it('admin create payload includes estimatedHours', async () => {
    vi.spyOn(tasksApi, 'createTask').mockResolvedValueOnce({ id: 10, title: 'New task' });
    renderForm('admin', { onCreated: vi.fn() });
    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'New task' } });
    fireEvent.change(screen.getByLabelText('Tiempo estimado (h)'), { target: { value: '2.5' } });
    await act(async () => {
      screen.getByText('Guardar').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });
    expect(tasksApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New task', estimatedHours: 2.5 })
    );
  });

  it('hides estimated hours from a developer', async () => {
    renderForm('developer');
    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });
    expect(screen.queryByLabelText('Tiempo estimado (h)')).not.toBeInTheDocument();
  });
```

Empty hours → POST `estimatedHours: null` for admin. Add that assertion in the existing “creates a task after Crear” test **after wrapping it with admin AuthContext**, or a dedicated case.

In `TaskDetailView.test.jsx` add (inside the existing describe, reuse `mockDetail` / `renderView`):

```jsx
  it('admin can save estimated hours', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'updateTask').mockResolvedValueOnce({ ...task, estimatedHours: 3 });
    renderView({ id: 1, role: 'admin' });
    fireEvent.change(await screen.findByLabelText('Tiempo estimado (h)'), { target: { value: '3' } });
    await waitFor(() => expect(tasksApi.updateTask).toHaveBeenCalledWith(9, { estimatedHours: 3 }));
  });

  it('hides estimated hours from a developer', async () => {
    mockDetail();
    renderView({ id: 1, role: 'developer' });
    expect(await screen.findByText('Build homepage')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tiempo estimado (h)')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd front && npm test -- src/components/kanban/TaskFormModal.test.jsx src/components/tasks/TaskDetailView.test.jsx
```

Expected: FAIL (label missing).

- [ ] **Step 3: Implement**

`TaskFormModal.jsx`:

```javascript
import { useAuth } from '../../context/AuthContext';
```

Inside the component:

```javascript
  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin';
  const [estimatedHours, setEstimatedHours] = useState('');
```

In `createTask` payload, if `isAdmin`:

```javascript
        estimatedHours: estimatedHours === '' ? null : Number(estimatedHours),
```

Reset `setEstimatedHours('')` on success with the other fields.

After the due date field, if `isAdmin`:

```jsx
            <div>
              <Label htmlFor="estimatedHours">Tiempo estimado (h)</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
```

`TaskDetailView.jsx`: add `const [estimatedHours, setEstimatedHours] = useState('');`. When the task loads, `setEstimatedHours(loadedTask?.estimatedHours ?? '')`.

Handler (same pattern as assignee):

```javascript
  async function handleEstimatedHoursChange(raw) {
    setEstimatedHours(raw);
    setError('');
    const value = raw === '' ? null : Number(raw);
    try {
      const saved = await tasksApi.updateTask(task.id, { estimatedHours: value });
      setTask((previous) => ({ ...previous, ...saved }));
    } catch (err) {
      setEstimatedHours(task.estimatedHours ?? '');
      setError(err.response?.data?.error || err.message);
    }
  }
```

After the assignee block, if `canAssign` (admin):

```jsx
        {canAssign && (
          <div className="mt-3 space-y-1">
            <Label htmlFor="estimatedHours">Tiempo estimado (h)</Label>
            <Input
              id="estimatedHours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => handleEstimatedHoursChange(e.target.value)}
            />
          </div>
        )}
```

Do not add hours to `TaskCard`.

- [ ] **Step 4: Run tests and make sure they pass**

```bash
cd front && npm test -- src/components/kanban/TaskFormModal.test.jsx src/components/tasks/TaskDetailView.test.jsx src/pages/TeamPage.test.jsx src/components/AppShell.test.jsx src/pages/KanbanPage.test.jsx
cd back && npm test -- tests/routes/stats.test.js tests/routes/tasks.test.js tests/utils/taskBuckets.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/components/kanban/TaskFormModal.jsx front/src/components/kanban/TaskFormModal.test.jsx front/src/components/tasks/TaskDetailView.jsx front/src/components/tasks/TaskDetailView.test.jsx
git commit -m "$(cat <<'EOF'
feat: let admins set estimated hours when creating or editing a task

EOF
)"
```
