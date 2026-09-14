# Project members Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins assign users to a project; those members see that project and its full Kanban, can create tasks for any member, can move only their own cards, and each create/move is stored on the task.

**Architecture:** New `ProjectMember` join table becomes the source of project access (replacing “has an assigned task”). New `TaskActivity` rows are written in the same DB transaction as `POST /tasks` and `PATCH /tasks/:id/status`. Frontend: members card on project detail, project-scoped Kanban for both roles, historial on task detail.

**Tech Stack:** Express, Sequelize (MySQL in dev, SQLite in Jest), React 19, Vite, Vitest, Testing Library, @dnd-kit/core. No new npm packages.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-14-project-members-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. No client role.
- Error bodies stay `{ error: string }` with these exact strings where listed: `Project not found`, `Task not found`, `User not found`, `Member not found`, `Already a member`, `Forbidden`, `Invalid status`, `Assignee must be a project member`.
- `GET /users` stays admin-only.
- Visible strings tests already lock must stay: `To Do`, `In Progress`, `Review`, `Done`, `Nueva tarea`, `Sin asignar`, `No se encontró`.
- New UI copy (exact): `Miembros`, `Agregar`, `Quitar`, `Sin miembros`, `Historial`, `Sin actividad`, `{name} creó la tarea`, `{name} movió {fromLabel} → {toLabel}`.
- Do not implement uploads, costs, contracts, budget, extra note types, or auto-adding members on later task assignment.
- TDD: failing test first. Commit after each task. Do not push.

## File map

| File | Role |
|---|---|
| `back/src/models/projectMember.js` | Join row `projectId` + `userId`, unique together |
| `back/src/models/taskActivity.js` | Append-only `created` / `status_changed` |
| `back/src/models/index.js` | Register models + `belongsToMany` / `hasMany` |
| `back/src/utils/projectAccess.js` | `isProjectMember`, `memberProjectIds` |
| `back/src/utils/backfillProjectMembers.js` | Idempotent member rows from existing assignees |
| `back/src/controllers/membersController.js` | GET/POST/DELETE `/projects/:id/members` |
| `back/src/controllers/projectsController.js` | `GET /projects` via membership |
| `back/src/controllers/tasksController.js` | List by membership, member create, activities |
| `back/src/routes/projects.js` | Member routes |
| `back/src/routes/tasks.js` | Drop admin-only on POST; add GET activities |
| `back/src/server.js` | Call backfill after `sync()` |
| `front/src/api/projects.js` | `listMembers`, `addMember`, `removeMember` |
| `front/src/api/tasks.js` | `listTaskActivities` |
| `front/src/components/projects/ProjectMembersCard.jsx` | Members UI |
| `front/src/pages/ProjectDetailPage.jsx` | Mount members card |
| `front/src/pages/KanbanPage.jsx` | Selector for both roles, filter, create, members as assignees |
| `front/src/components/kanban/TaskCard.jsx` | `draggable` flag |
| `front/src/components/kanban/KanbanColumn.jsx` | Pass `draggable` |
| `front/src/pages/TaskDetailPage.jsx` | Historial card |

---

### Task 1: ProjectMember model

**Files:**
- Create: `back/src/models/projectMember.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/projectMember.test.js`

**Interfaces:**
- Consumes: existing `User`, `Project`, `sequelize`.
- Produces: `ProjectMember` model with fields `id`, `projectId` (INTEGER, required), `userId` (INTEGER, required), `createdAt`, `updatedAt`. Unique index on `(projectId, userId)`. Associations: `Project.belongsToMany(User, { through: ProjectMember, as: 'members', foreignKey: 'projectId', otherKey: 'userId' })` and `User.belongsToMany(Project, { through: ProjectMember, as: 'memberProjects', foreignKey: 'userId', otherKey: 'projectId' })`. Export `ProjectMember` from `back/src/models/index.js`.

- [ ] **Step 1: Write the failing test**

Create `back/tests/models/projectMember.test.js`:

```javascript
const { sequelize, User, Project, ProjectMember } = require('../../src/models');

describe('ProjectMember model', () => {
  let project;
  let developer;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'Website Revamp' });
    developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('links a user to a project as a member', async () => {
    const row = await ProjectMember.create({ projectId: project.id, userId: developer.id });
    expect(row.projectId).toBe(project.id);
    expect(row.userId).toBe(developer.id);
    const withMembers = await Project.findByPk(project.id, { include: ['members'] });
    expect(withMembers.members.map((u) => u.email)).toEqual(['dev1@example.com']);
  });

  it('rejects a duplicate member on the same project', async () => {
    await expect(
      ProjectMember.create({ projectId: project.id, userId: developer.id })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/projectMember.test.js
```

Expected: FAIL (cannot find `ProjectMember` or include alias `members`).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/models/projectMember.js`:

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProjectMember = sequelize.define(
    'ProjectMember',
    {
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      indexes: [{ unique: true, fields: ['projectId', 'userId'] }],
    }
  );
  return ProjectMember;
};
```

In `back/src/models/index.js`, after `const Note = require('./note')(sequelize);` add:

```javascript
const ProjectMember = require('./projectMember')(sequelize);
```

After the existing associations, add:

```javascript
Project.belongsToMany(User, {
  through: ProjectMember,
  as: 'members',
  foreignKey: 'projectId',
  otherKey: 'userId',
});
User.belongsToMany(Project, {
  through: ProjectMember,
  as: 'memberProjects',
  foreignKey: 'userId',
  otherKey: 'projectId',
});
```

Add `ProjectMember` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/projectMember.test.js
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add back/src/models/projectMember.js back/src/models/index.js back/tests/models/projectMember.test.js
git commit -m "$(cat <<'EOF'
feat: add ProjectMember join model

EOF
)"
```

---

### Task 2: Membership helpers and assignee backfill

**Files:**
- Create: `back/src/utils/projectAccess.js`
- Create: `back/src/utils/backfillProjectMembers.js`
- Modify: `back/src/server.js`
- Test: `back/tests/utils/projectAccess.test.js`
- Test: `back/tests/utils/backfillProjectMembers.test.js`

**Interfaces:**
- Consumes: `ProjectMember`, `Task` from `../models`.
- Produces:
  - `async function isProjectMember(userId, projectId): Promise<boolean>`
  - `async function memberProjectIds(userId): Promise<number[]>` — distinct project ids, may be empty
  - `async function backfillProjectMembers(): Promise<void>` — skip when `ProjectMember.count()` is greater than zero. For an empty table, add each distinct `(projectId, assigneeId)` on `Task` where `assigneeId` is not null with `ProjectMember.findOrCreate({ where: { projectId, userId: assigneeId } })`. This makes the boot helper a one-shot first-deploy safety net, so later boots do not restore deliberately removed members. Creating a task with an assignee does **not** call this from the tasks controller.
  - `server.js` after `await sequelize.sync()` calls `await backfillProjectMembers()`.

- [ ] **Step 1: Write the failing tests**

Create `back/tests/utils/projectAccess.test.js`:

```javascript
const { sequelize, User, Project, ProjectMember } = require('../../src/models');
const { isProjectMember, memberProjectIds } = require('../../src/utils/projectAccess');

describe('projectAccess', () => {
  let project;
  let other;
  let developer;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'A' });
    other = await Project.create({ name: 'B' });
    developer = await User.create({
      name: 'Dev',
      email: 'dev@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('isProjectMember is true only for the joined project', async () => {
    expect(await isProjectMember(developer.id, project.id)).toBe(true);
    expect(await isProjectMember(developer.id, other.id)).toBe(false);
  });

  it('memberProjectIds returns only joined projects', async () => {
    expect(await memberProjectIds(developer.id)).toEqual([project.id]);
  });
});
```

Create `back/tests/utils/backfillProjectMembers.test.js`:

```javascript
const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { backfillProjectMembers } = require('../../src/utils/backfillProjectMembers');

describe('backfillProjectMembers', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates members from distinct task assignees and is idempotent', async () => {
    const project = await Project.create({ name: 'A' });
    const dev = await User.create({
      name: 'Dev',
      email: 'dev@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await Task.create({ projectId: project.id, title: 'One', assigneeId: dev.id });
    await Task.create({ projectId: project.id, title: 'Two', assigneeId: dev.id });
    await Task.create({ projectId: project.id, title: 'Unassigned' });

    await backfillProjectMembers();
    await backfillProjectMembers();

    const rows = await ProjectMember.findAll({ where: { projectId: project.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(dev.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/utils/projectAccess.test.js tests/utils/backfillProjectMembers.test.js
```

Expected: FAIL (cannot find modules).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/utils/projectAccess.js`:

```javascript
const { ProjectMember } = require('../models');

async function isProjectMember(userId, projectId) {
  const row = await ProjectMember.findOne({
    where: { userId, projectId },
  });
  return Boolean(row);
}

async function memberProjectIds(userId) {
  const rows = await ProjectMember.findAll({
    where: { userId },
    attributes: ['projectId'],
    order: [['projectId', 'ASC']],
  });
  return rows.map((row) => row.projectId);
}

module.exports = { isProjectMember, memberProjectIds };
```

Create `back/src/utils/backfillProjectMembers.js`:

```javascript
const { Op } = require('sequelize');
const { Task, ProjectMember } = require('../models');

// Boot helper: copy existing task assignees into ProjectMember.
// Task create/update must not call this. New assignees are not auto-members.
async function backfillProjectMembers() {
  if ((await ProjectMember.count()) > 0) {
    return;
  }

  const tasks = await Task.findAll({
    attributes: ['projectId', 'assigneeId'],
    where: { assigneeId: { [Op.ne]: null } },
  });
  const seen = new Set();
  for (const task of tasks) {
    const key = `${task.projectId}:${task.assigneeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await ProjectMember.findOrCreate({
      where: { projectId: task.projectId, userId: task.assigneeId },
    });
  }
}

module.exports = { backfillProjectMembers };
```

Replace `back/src/server.js` with:

```javascript
const app = require('./app');
const { sequelize } = require('./models');
const { startReminderJob } = require('./jobs/reminderJob');
const { backfillProjectMembers } = require('./utils/backfillProjectMembers');

const PORT = process.env.PORT || 4000;

async function main() {
  await sequelize.sync();
  await backfillProjectMembers();
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`portal-admin-intk backend listening on port ${PORT}`);
  });
}

main();
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/utils/projectAccess.test.js tests/utils/backfillProjectMembers.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/utils/projectAccess.js back/src/utils/backfillProjectMembers.js back/src/server.js back/tests/utils/projectAccess.test.js back/tests/utils/backfillProjectMembers.test.js
git commit -m "$(cat <<'EOF'
feat: add membership helpers and assignee backfill

EOF
)"
```

---

### Task 3: Scope GET /projects to membership

**Files:**
- Modify: `back/src/controllers/projectsController.js`
- Modify: `back/tests/routes/projects.test.js`

**Interfaces:**
- Consumes: `memberProjectIds(userId)` from `back/src/utils/projectAccess.js`.
- Produces: `GET /projects` for developer returns only projects they belong to via `ProjectMember`, ordered by `id ASC`. Empty membership → `[]`. Admin unchanged. Create/update/delete still admin-only.

- [ ] **Step 1: Rewrite the developer listing tests first (they must fail on current code)**

Replace `back/tests/routes/projects.test.js` with:

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('projects routes', () => {
  let adminCookie;
  let developerCookie;
  let memberProject;
  let otherProject;
  let developer;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;

    memberProject = await Project.create({ name: 'Assigned Project' });
    otherProject = await Project.create({ name: 'Other Project' });
    await ProjectMember.create({ projectId: memberProject.id, userId: developer.id });
    await Task.create({ projectId: otherProject.id, title: 'Orphan task', assigneeId: developer.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('admin sees all projects', async () => {
    const res = await request(app).get('/projects').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('developer only sees projects they are a member of', async () => {
    const res = await request(app).get('/projects').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Assigned Project');
  });

  it('developer with a task but no membership does not see that project', async () => {
    const res = await request(app).get('/projects').set('Cookie', developerCookie);
    expect(res.body.map((p) => p.name)).not.toContain('Other Project');
  });

  it('admin creates a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', adminCookie)
      .send({ name: 'New Project', description: 'desc' });
    expect(res.status).toBe(201);
  });

  it('developer cannot create a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Cookie', developerCookie)
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('admin updates and deletes a project', async () => {
    const putRes = await request(app)
      .put(`/projects/${otherProject.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'archived' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe('archived');

    const deleteRes = await request(app).delete(`/projects/${otherProject.id}`).set('Cookie', adminCookie);
    expect(deleteRes.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to verify the membership cases fail**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/projects.test.js
```

Expected: FAIL on `developer only sees projects they are a member of` and/or the orphan-task case, because list still uses assigned tasks (`Other Project` would appear).

- [ ] **Step 3: Write minimal implementation**

Replace `back/src/controllers/projectsController.js` with:

```javascript
const { Project } = require('../models');
const { memberProjectIds } = require('../utils/projectAccess');

async function list(req, res) {
  if (req.user.role === 'admin') {
    const projects = await Project.findAll({ order: [['id', 'ASC']] });
    return res.json(projects);
  }

  const projectIds = await memberProjectIds(req.user.id);
  if (projectIds.length === 0) {
    return res.json([]);
  }
  const projects = await Project.findAll({
    where: { id: projectIds },
    order: [['id', 'ASC']],
  });
  return res.json(projects);
}

async function create(req, res) {
  const { name, description } = req.body;
  const project = await Project.create({ name, description });
  return res.status(201).json(project);
}

async function update(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  const { name, description, status } = req.body;
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (status !== undefined) project.status = status;
  await project.save();
  return res.json(project);
}

async function remove(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  await project.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/projects.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/projectsController.js back/tests/routes/projects.test.js
git commit -m "$(cat <<'EOF'
feat: list projects by membership instead of assigned tasks

EOF
)"
```

---

### Task 4: Project members HTTP API

**Files:**
- Create: `back/src/controllers/membersController.js`
- Modify: `back/src/routes/projects.js`
- Test: `back/tests/routes/members.test.js`

**Interfaces:**
- Consumes: `Project`, `User`, `ProjectMember`; `isProjectMember`; `toPublicUser` from `authController` (`{ id, name, email, role }`).
- Produces:
  - `GET /projects/:id/members` — admin or member. 200 array of public users ordered by `id ASC`. 404 `{ error: 'Project not found' }`. 403 `{ error: 'Forbidden' }` if developer is not a member.
  - `POST /projects/:id/members` — `requireRole('admin')`. Body `{ userId }`. 201 public user. 404 project or user. 409 `{ error: 'Already a member' }` via `findOrCreate` (`created === false`).
  - `DELETE /projects/:id/members/:userId` — `requireRole('admin')`. 204. 404 project or `{ error: 'Member not found' }`. Does not delete tasks.
  - Route order in `projects.js`: member routes registered **before** `router.delete('/:id')`.

- [ ] **Step 1: Write the failing test**

Create `back/tests/routes/members.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('project members routes', () => {
  let adminCookie;
  let developerCookie;
  let outsiderCookie;
  let project;
  let developer;
  let outsider;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    await Task.create({ projectId: project.id, title: 'Keep me', assigneeId: developer.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('member can list members; outsider cannot', async () => {
    const ok = await request(app).get(`/projects/${project.id}/members`).set('Cookie', developerCookie);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual([
      expect.objectContaining({ id: developer.id, name: 'Dev', email: 'dev@example.com', role: 'developer' }),
    ]);
    expect(ok.body[0].passwordHash).toBeUndefined();

    const denied = await request(app).get(`/projects/${project.id}/members`).set('Cookie', outsiderCookie);
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: 'Forbidden' });
  });

  it('admin adds a member and rejects duplicates', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/members`)
      .set('Cookie', adminCookie)
      .send({ userId: outsider.id });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({ id: outsider.id, email: 'out@example.com' })
    );

    const dup = await request(app)
      .post(`/projects/${project.id}/members`)
      .set('Cookie', adminCookie)
      .send({ userId: outsider.id });
    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ error: 'Already a member' });
  });

  it('developer cannot add or remove members', async () => {
    const post = await request(app)
      .post(`/projects/${project.id}/members`)
      .set('Cookie', developerCookie)
      .send({ userId: outsider.id });
    expect(post.status).toBe(403);

    const del = await request(app)
      .delete(`/projects/${project.id}/members/${outsider.id}`)
      .set('Cookie', developerCookie);
    expect(del.status).toBe(403);
  });

  it('admin remove does not delete tasks', async () => {
    const del = await request(app)
      .delete(`/projects/${project.id}/members/${outsider.id}`)
      .set('Cookie', adminCookie);
    expect(del.status).toBe(204);

    const missing = await request(app)
      .delete(`/projects/${project.id}/members/${outsider.id}`)
      .set('Cookie', adminCookie);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Member not found' });

    const tasks = await Task.findAll({ where: { projectId: project.id } });
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('returns 404 for a missing project', async () => {
    const res = await request(app).get('/projects/9999/members').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Project not found' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/members.test.js
```

Expected: FAIL (404 on `/projects/:id/members` because no such route).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/controllers/membersController.js`:

```javascript
const { Project, User, ProjectMember } = require('../models');
const { toPublicUser } = require('./authController');
const { isProjectMember } = require('../utils/projectAccess');

async function loadProject(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

async function list(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, project.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const members = await project.getMembers({ order: [['id', 'ASC']] });
  return res.json(members.map(toPublicUser));
}

async function add(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const user = await User.findByPk(req.body.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const [, created] = await ProjectMember.findOrCreate({
    where: { projectId: project.id, userId: user.id },
  });
  if (!created) {
    return res.status(409).json({ error: 'Already a member' });
  }
  return res.status(201).json(toPublicUser(user));
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const row = await ProjectMember.findOne({
    where: { projectId: project.id, userId: req.params.userId },
  });
  if (!row) {
    return res.status(404).json({ error: 'Member not found' });
  }
  await row.destroy();
  return res.status(204).send();
}

module.exports = { list, add, remove };
```

Replace `back/src/routes/projects.js` with:

```javascript
const express = require('express');
const controller = require('../controllers/projectsController');
const members = require('../controllers/membersController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('admin'), controller.create);
router.get('/:id/members', members.list);
router.post('/:id/members', requireRole('admin'), members.add);
router.delete('/:id/members/:userId', requireRole('admin'), members.remove);
router.put('/:id', requireRole('admin'), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/members.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/membersController.js back/src/routes/projects.js back/tests/routes/members.test.js
git commit -m "$(cat <<'EOF'
feat: add project members API

EOF
)"
```

---

### Task 5: Scope GET /tasks to member projects

**Files:**
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/tests/routes/tasks.test.js`

**Interfaces:**
- Consumes: `isProjectMember`, `memberProjectIds`.
- Produces: `GET /tasks` for developer returns **all** tasks whose `projectId` is in `memberProjectIds`. Query `projectId`: 200 all tasks of that project if member; 403 `{ error: 'Forbidden' }` if not. Empty membership and no `projectId` → `[]`. Do **not** force `assigneeId = req.user.id`. Admin listing unchanged. Leave `POST` as admin-only until Task 7 (do not change the existing “developer cannot create” test yet).

- [ ] **Step 1: Change the listing test so current code fails**

In `back/tests/routes/tasks.test.js`:

1. Import `ProjectMember`.
2. In `beforeAll`, after creating `project` and users, add `await ProjectMember.create({ projectId: project.id, userId: developer.id });` (the first developer only, not `otherDeveloper`).
3. Replace the test `'developer listing tasks only sees their own regardless of query params'` with:

```javascript
  it('developer member listing tasks sees all tasks on the project', async () => {
    const res = await request(app)
      .get(`/tasks?projectId=${project.id}`)
      .set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('developer who is not a member gets 403 when filtering by projectId', async () => {
    const res = await request(app)
      .get(`/tasks?projectId=${project.id}`)
      .set('Cookie', otherDeveloperCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });
```

Keep the remaining tests in that file as they are.

- [ ] **Step 2: Run tests to verify listing fails**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/tasks.test.js
```

Expected: FAIL — member listing still returns 1 task (assignee filter).

- [ ] **Step 3: Write minimal implementation**

In `back/src/controllers/tasksController.js`, require:

```javascript
const { Task } = require('../models');
const { isProjectMember, memberProjectIds } = require('../utils/projectAccess');
```

Replace `list` with:

```javascript
async function list(req, res) {
  const where = {};
  if (req.user.role === 'admin') {
    if (req.query.projectId) where.projectId = req.query.projectId;
    if (req.query.assigneeId) where.assigneeId = req.query.assigneeId;
  } else if (req.query.projectId) {
    const allowed = await isProjectMember(req.user.id, req.query.projectId);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    where.projectId = req.query.projectId;
  } else {
    const ids = await memberProjectIds(req.user.id);
    if (ids.length === 0) {
      return res.json([]);
    }
    where.projectId = ids;
  }
  const tasks = await Task.findAll({ where, order: [['id', 'ASC']] });
  return res.json(tasks);
}
```

Do not change `create` / `update` / `updateStatus` / `remove` in this task.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/tasks.test.js
```

Expected: PASS (including still-failing-to-create-as-developer until Task 7).

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/tasksController.js back/tests/routes/tasks.test.js
git commit -m "$(cat <<'EOF'
feat: list all tasks on projects the developer belongs to

EOF
)"
```

---

### Task 6: TaskActivity model

**Files:**
- Create: `back/src/models/taskActivity.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/taskActivity.test.js`

**Interfaces:**
- Consumes: `Task`, `User`.
- Produces: `TaskActivity` with `taskId` (required INTEGER), `userId` (required INTEGER), `type` ENUM `created` | `status_changed`, `fromStatus` ENUM of task statuses nullable, `toStatus` ENUM of task statuses nullable. Associations: `Task.hasMany(TaskActivity, { foreignKey: 'taskId', as: 'activities' })`, `TaskActivity.belongsTo(Task, { foreignKey: 'taskId', as: 'task' })`, `TaskActivity.belongsTo(User, { foreignKey: 'userId', as: 'user' })`. Export `TaskActivity`.

- [ ] **Step 1: Write the failing test**

Create `back/tests/models/taskActivity.test.js`:

```javascript
const { sequelize, User, Project, Task, TaskActivity } = require('../../src/models');

describe('TaskActivity model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('records a created event with toStatus todo', async () => {
    const project = await Project.create({ name: 'A' });
    const user = await User.create({
      name: 'Dev',
      email: 'dev@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const task = await Task.create({ projectId: project.id, title: 'T' });
    const row = await TaskActivity.create({
      taskId: task.id,
      userId: user.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'todo',
    });
    expect(row.type).toBe('created');
    expect(row.fromStatus).toBeNull();
    expect(row.toStatus).toBe('todo');
    const withUser = await TaskActivity.findByPk(row.id, { include: ['user'] });
    expect(withUser.user.name).toBe('Dev');
  });

  it('rejects an invalid type', async () => {
    const project = await Project.create({ name: 'B' });
    const user = await User.create({
      name: 'Dev2',
      email: 'dev2@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const task = await Task.create({ projectId: project.id, title: 'T2' });
    await expect(
      TaskActivity.create({
        taskId: task.id,
        userId: user.id,
        type: 'renamed',
        toStatus: 'todo',
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/taskActivity.test.js
```

Expected: FAIL (no `TaskActivity`).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/models/taskActivity.js`:

```javascript
const { DataTypes } = require('sequelize');

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

module.exports = (sequelize) => {
  const TaskActivity = sequelize.define('TaskActivity', {
    taskId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM('created', 'status_changed'),
      allowNull: false,
      validate: {
        isIn: {
          args: [['created', 'status_changed']],
          msg: 'Type must be created or status_changed',
        },
      },
    },
    fromStatus: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: true,
    },
    toStatus: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: true,
    },
  });
  return TaskActivity;
};
```

In `back/src/models/index.js`, after ProjectMember:

```javascript
const TaskActivity = require('./taskActivity')(sequelize);
```

Associations:

```javascript
Task.hasMany(TaskActivity, { foreignKey: 'taskId', as: 'activities' });
TaskActivity.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
User.hasMany(TaskActivity, { foreignKey: 'userId', as: 'taskActivities' });
TaskActivity.belongsTo(User, { foreignKey: 'userId', as: 'user' });
```

Export `TaskActivity`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/taskActivity.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/models/taskActivity.js back/src/models/index.js back/tests/models/taskActivity.test.js
git commit -m "$(cat <<'EOF'
feat: add TaskActivity model

EOF
)"
```

---

### Task 7: Members can create tasks (with `created` activity)

**Files:**
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/src/routes/tasks.js`
- Modify: `back/tests/routes/tasks.test.js`

**Interfaces:**
- Consumes: `Project`, `Task`, `TaskActivity`, `sequelize`; `isProjectMember`.
- Produces: `POST /tasks` authenticated (remove `requireRole('admin')` from the route). Admin: any existing project; `assigneeId` any user or null. Developer: must be member of `projectId` else 403 `Forbidden`; `assigneeId` null or a member else 400 `{ error: 'Assignee must be a project member' }`; missing project 404 `{ error: 'Project not found' }`. Success 201 task **and** `TaskActivity` `{ type: 'created', fromStatus: null, toStatus: 'todo', userId: req.user.id }` in one transaction. Rollback on activity failure.

- [ ] **Step 1: Replace the create tests**

In `back/tests/routes/tasks.test.js` replace `'developer cannot create a task'` and keep `'admin creates a task'`. Add after the admin create test:

```javascript
  it('developer member creates a task assigned to another member', async () => {
    await ProjectMember.create({ projectId: project.id, userId: otherDeveloper.id });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: project.id, title: 'Pair work', assigneeId: otherDeveloper.id });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Pair work');
    const { TaskActivity } = require('../../src/models');
    const activities = await TaskActivity.findAll({ where: { taskId: res.body.id } });
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('created');
    expect(activities[0].toStatus).toBe('todo');
  });

  it('developer cannot create a task on a project they do not belong to', async () => {
    const foreign = await Project.create({ name: 'Secret' });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: foreign.id, title: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('developer cannot assign a non-member', async () => {
    const stranger = await User.create({
      name: 'Stranger',
      email: 'stranger@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: project.id, title: 'Nope', assigneeId: stranger.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Assignee must be a project member' });
  });
```

Remove the old `'developer cannot create a task'` test entirely.

Also require `ProjectMember` if not already imported from Task 5.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/tasks.test.js
```

Expected: FAIL — developer POST still 403 from `requireRole('admin')`.

- [ ] **Step 3: Write minimal implementation**

Replace `back/src/routes/tasks.js` with:

```javascript
const express = require('express');
const controller = require('../controllers/tasksController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/status', controller.updateStatus);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
```

At top of `tasksController.js`:

```javascript
const { Task, Project, TaskActivity, sequelize } = require('../models');
const { isProjectMember, memberProjectIds } = require('../utils/projectAccess');
```

Replace `create` with:

```javascript
async function create(req, res) {
  const { projectId, title, description, assigneeId, dueDate } = req.body;
  const project = await Project.findByPk(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, project.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (assigneeId) {
      const assigneeOk = await isProjectMember(assigneeId, project.id);
      if (!assigneeOk) {
        return res.status(400).json({ error: 'Assignee must be a project member' });
      }
    }
  }

  const t = await sequelize.transaction();
  try {
    const task = await Task.create(
      { projectId, title, description, assigneeId, dueDate },
      { transaction: t }
    );
    await TaskActivity.create(
      {
        taskId: task.id,
        userId: req.user.id,
        type: 'created',
        fromStatus: null,
        toStatus: task.status,
      },
      { transaction: t }
    );
    await t.commit();
    return res.status(201).json(task);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/tasks.test.js
```

Expected: PASS. Then `npm test` for the whole backend. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/tasksController.js back/src/routes/tasks.js back/tests/routes/tasks.test.js
git commit -m "$(cat <<'EOF'
feat: allow project members to create tasks with activity log

EOF
)"
```

---

### Task 8: Status-change activity and GET /tasks/:id/activities

**Files:**
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/src/routes/tasks.js`
- Test: `back/tests/routes/activities.test.js`

**Interfaces:**
- Consumes: `Task`, `TaskActivity`, `User`, `sequelize`; `isOwnerOrAdmin`; `isProjectMember`.
- Produces:
  - `PATCH /tasks/:id/status` — same auth as today. If new status equals current, 200 and **no** extra activity. Else save + `TaskActivity` `{ type: 'status_changed', fromStatus, toStatus }` in one transaction.
  - `GET /tasks/:id/activities` — admin or project member. Chronological (`id ASC`). Shape `[{ id, type, fromStatus, toStatus, createdAt, user: { id, name } }]`. 404 `{ error: 'Task not found' }`. 403 `{ error: 'Forbidden' }` for non-member developer.
  - Register `router.get('/:id/activities', controller.listActivities)` **before** other `/:id` routes is not required (GET vs PATCH), but place it with the other `/:id` routes.

- [ ] **Step 1: Write the failing test**

Create `back/tests/routes/activities.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task, ProjectMember } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('task activities routes', () => {
  let adminCookie;
  let developerCookie;
  let outsiderCookie;
  let task;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    const outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
    const created = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Build homepage', assigneeId: developer.id });
    task = created.body;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('lists created then status_changed in order', async () => {
    const moved = await request(app)
      .patch(`/tasks/${task.id}/status`)
      .set('Cookie', developerCookie)
      .send({ status: 'in_progress' });
    expect(moved.status).toBe(200);

    const same = await request(app)
      .patch(`/tasks/${task.id}/status`)
      .set('Cookie', developerCookie)
      .send({ status: 'in_progress' });
    expect(same.status).toBe(200);

    const res = await request(app).get(`/tasks/${task.id}/activities`).set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        type: 'created',
        fromStatus: null,
        toStatus: 'todo',
        user: { id: expect.any(Number), name: 'Admin' },
      })
    );
    expect(res.body[1]).toEqual(
      expect.objectContaining({
        type: 'status_changed',
        fromStatus: 'todo',
        toStatus: 'in_progress',
        user: { id: expect.any(Number), name: 'Dev' },
      })
    );
  });

  it('forbids a non-member from reading activities', async () => {
    const res = await request(app).get(`/tasks/${task.id}/activities`).set('Cookie', outsiderCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/activities.test.js
```

Expected: FAIL (no GET activities route, and PATCH may not write `status_changed`).

- [ ] **Step 3: Write minimal implementation**

Add to `tasksController.js` and export it:

```javascript
async function updateStatus(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!isOwnerOrAdmin(task, req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (task.status === status) {
    return res.json(task);
  }
  const fromStatus = task.status;
  const t = await sequelize.transaction();
  try {
    task.status = status;
    await task.save({ transaction: t });
    await TaskActivity.create(
      {
        taskId: task.id,
        userId: req.user.id,
        type: 'status_changed',
        fromStatus,
        toStatus: status,
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

async function listActivities(req, res) {
  const { User } = require('../models');
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, task.projectId);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const rows = await TaskActivity.findAll({
    where: { taskId: task.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
    order: [['id', 'ASC']],
  });
  return res.json(
    rows.map((row) => ({
      id: row.id,
      type: row.type,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      createdAt: row.createdAt,
      user: { id: row.user.id, name: row.user.name },
    }))
  );
}
```

Prefer putting `User` in the existing `require('../models')` at the top instead of inside `listActivities`.

Add `listActivities` to `module.exports`.

In `back/src/routes/tasks.js` add:

```javascript
router.get('/:id/activities', controller.listActivities);
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/activities.test.js
npm test
```

Expected: all backend tests PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/tasksController.js back/src/routes/tasks.js back/tests/routes/activities.test.js
git commit -m "$(cat <<'EOF'
feat: record status moves and expose task activity history

EOF
)"
```

---

### Task 9: Project detail members UI

**Files:**
- Modify: `front/src/api/projects.js`
- Create: `front/src/components/projects/ProjectMembersCard.jsx`
- Test: `front/src/components/projects/ProjectMembersCard.test.jsx`
- Modify: `front/src/pages/ProjectDetailPage.jsx`
- Modify: `front/src/pages/ProjectDetailPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()`, `GET /users` (admin only, via existing `listUsers`), members API.
- Produces:
  - `listMembers(projectId)` → `GET /projects/${projectId}/members`
  - `addMember(projectId, userId)` → `POST` `{ userId }` → 201 user
  - `removeMember(projectId, userId)` → `DELETE`
  - Card title `Miembros`. Empty `Sin miembros`. Admin: select of non-members (label `name`), button `Agregar`, rows `name` + `email` + `Quitar`. Developer: names only, no `Agregar`/`Quitar`.

- [ ] **Step 1: Write the failing tests**

Append to `front/src/api/projects.js` (implementation can wait until step 3; tests mock the module):

Create `front/src/components/projects/ProjectMembersCard.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import ProjectMembersCard from './ProjectMembersCard';
import * as projectsApi from '../../api/projects';
import * as usersApi from '../../api/users';

function renderCard(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <ProjectMembersCard projectId={7} />
    </AuthContext.Provider>
  );
}

describe('ProjectMembersCard', () => {
  it('lets an admin add and remove members', async () => {
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
    ]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
      { id: 3, name: 'Dev Two', email: 'dev2@example.com', role: 'developer' },
    ]);
    vi.spyOn(projectsApi, 'addMember').mockResolvedValue({
      id: 3,
      name: 'Dev Two',
      email: 'dev2@example.com',
      role: 'developer',
    });
    vi.spyOn(projectsApi, 'removeMember').mockResolvedValue();

    renderCard('admin');

    await waitFor(() => expect(screen.getByText('Dev One')).toBeInTheDocument());
    expect(screen.getByText('dev1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Agregar')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dev Two' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Agregar'));

    await waitFor(() => expect(projectsApi.addMember).toHaveBeenCalledWith(7, 3));
    expect(await screen.findByText('Dev Two')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Quitar')[0]);
    await waitFor(() => expect(projectsApi.removeMember).toHaveBeenCalled());
  });

  it('shows a read-only list for developers', async () => {
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
    ]);

    renderCard('developer');

    await waitFor(() => expect(screen.getByText('Dev One')).toBeInTheDocument());
    expect(screen.queryByText('Agregar')).not.toBeInTheDocument();
    expect(screen.queryByText('Quitar')).not.toBeInTheDocument();
    expect(screen.queryByText('dev1@example.com')).not.toBeInTheDocument();
  });

  it('shows Sin miembros when the list is empty', async () => {
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    renderCard('admin');
    expect(await screen.findByText('Sin miembros')).toBeInTheDocument();
  });
});
```

In `front/src/pages/ProjectDetailPage.test.jsx`, wrap both existing renders with AuthContext (admin is fine) so `useAuth` in the new card does not crash:

```jsx
import { AuthContext } from '../context/AuthContext';

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role: 'admin' }, loading: false }}>
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}
```

Use `renderPage` in both existing tests (second test uses `/projects/99` — add a `renderMissing` helper with `initialEntries={['/projects/99']}`). Mock `projectsApi.listMembers` to `[]` and `usersApi.listUsers` to `[]` in those tests.

Add one assertion to the first test after notes:

```javascript
expect(screen.getByText('Miembros')).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/projects/ProjectMembersCard.test.jsx src/pages/ProjectDetailPage.test.jsx
```

Expected: FAIL (missing component / missing `Miembros`).

- [ ] **Step 3: Write minimal implementation**

Append to `front/src/api/projects.js`:

```javascript
export async function listMembers(projectId) {
  const res = await api.get(`/projects/${projectId}/members`);
  return res.data;
}

export async function addMember(projectId, userId) {
  const res = await api.post(`/projects/${projectId}/members`, { userId });
  return res.data;
}

export async function removeMember(projectId, userId) {
  await api.delete(`/projects/${projectId}/members/${userId}`);
}
```

Create `front/src/components/projects/ProjectMembersCard.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as projectsApi from '../../api/projects';
import * as usersApi from '../../api/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectMembersCard({ projectId }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    projectsApi.listMembers(projectId).then(setMembers);
    if (isAdmin) {
      usersApi.listUsers().then(setUsers);
    }
  }, [projectId, isAdmin]);

  const available = users.filter((u) => !members.some((m) => m.id === u.id));

  async function handleAdd(e) {
    e.preventDefault();
    if (!selectedUserId) return;
    const added = await projectsApi.addMember(projectId, Number(selectedUserId));
    setMembers((prev) => [...prev, added]);
    setSelectedUserId('');
  }

  async function handleRemove(userId) {
    await projectsApi.removeMember(projectId, userId);
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Miembros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdmin && (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-md border border-input bg-card px-2 py-2 text-sm"
            >
              <option value="">Seleccionar usuario</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Button type="submit">Agregar</Button>
          </form>
        )}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin miembros</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  {isAdmin && <p className="text-xs text-muted-foreground">{m.email}</p>}
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" type="button" onClick={() => handleRemove(m.id)}>
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

In `ProjectDetailPage.jsx`, import `ProjectMembersCard` and render it above the notes card:

```jsx
<ProjectMembersCard projectId={project.id} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/projects/ProjectMembersCard.test.jsx src/pages/ProjectDetailPage.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/projects.js front/src/components/projects/ProjectMembersCard.jsx front/src/components/projects/ProjectMembersCard.test.jsx front/src/pages/ProjectDetailPage.jsx front/src/pages/ProjectDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: add project members card on project detail

EOF
)"
```

---

### Task 10: Kanban canvas per project, member create, own-card drag

**Files:**
- Modify: `front/src/pages/KanbanPage.jsx`
- Modify: `front/src/pages/KanbanPage.test.jsx`
- Modify: `front/src/components/kanban/TaskCard.jsx`
- Modify: `front/src/components/kanban/KanbanColumn.jsx`
- Test: `front/src/components/kanban/TaskCard.test.jsx`

**Interfaces:**
- Consumes: `listProjects`, `listMembers(projectId)`, `listTasks`, `TaskFormModal` (`users` prop = members), `useAuth`.
- Produces: project `<select>` (role `combobox`) for admin **and** developer. Tasks rendered only when `String(task.projectId) === String(selectedProjectId)`. No projects → empty columns, no `Nueva tarea`. With a selected project → `Nueva tarea` for both roles; assignee dropdown from members. `TaskCard({ task, draggable })` — `useDraggable({ id: String(task.id), disabled: !draggable })`. Developer: `draggable={task.assigneeId === user.id}`. Admin: `draggable={true}`. Stop calling `usersApi.listUsers` on this page.

- [ ] **Step 1: Write the failing tests**

Replace `front/src/pages/KanbanPage.test.jsx` with:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import KanbanPage from './KanbanPage';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';

function renderAs(role, userId = 1) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { id: userId, role }, loading: false }}>
        <KanbanPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('KanbanPage', () => {
  it('groups fetched tasks for the selected project into status columns', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Build homepage', status: 'todo', projectId: 1, assigneeId: 1 },
      { id: 2, title: 'Fix nav bug', status: 'in_progress', projectId: 1, assigneeId: 1 },
      { id: 3, title: 'QA pass', status: 'done', projectId: 1, assigneeId: 2 },
      { id: 4, title: 'Other project card', status: 'todo', projectId: 2, assigneeId: 1 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);

    renderAs('developer');

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();
    expect(screen.getByText('QA pass')).toBeInTheDocument();
    expect(screen.queryByText('Other project card')).not.toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('lets a developer pick a project and create a task', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);

    renderAs('developer');

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('1'));
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '2' } });
    expect(select).toHaveValue('2');
  });

  it('lets an admin pick which project the dropdown is showing', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);

    renderAs('admin');

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('1'));
    fireEvent.change(select, { target: { value: '2' } });
    expect(select).toHaveValue('2');
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
  });
});
```

Create `front/src/components/kanban/TaskCard.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import TaskCard from './TaskCard';

describe('TaskCard', () => {
  it('still links to the task when it is not draggable', () => {
    render(
      <MemoryRouter>
        <DndContext>
          <TaskCard task={{ id: 9, title: 'Teammate card', status: 'todo' }} draggable={false} />
        </DndContext>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Teammate card' })).toHaveAttribute('href', '/tasks/9');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskCard.test.jsx
```

Expected: FAIL — developer has no combobox / `Nueva tarea`; other-project card still visible; `draggable` prop unused.

- [ ] **Step 3: Write minimal implementation**

Replace `front/src/components/kanban/TaskCard.jsx` with:

```jsx
import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';

const DOT = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-primary',
  review: 'bg-rail',
  done: 'bg-teal-soft',
};

export default function TaskCard({ task, draggable = true }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: String(task.id),
    disabled: !draggable,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={`rounded-lg bg-card p-2 text-sm shadow-card ring-1 ring-border ${
        draggable ? 'cursor-grab' : 'cursor-default'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 size-2 shrink-0 rounded-full ${DOT[task.status] || DOT.todo}`} />
        <Link to={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
          {task.title}
        </Link>
      </div>
    </div>
  );
}
```

In `KanbanColumn.jsx`, change the signature to `function KanbanColumn({ status, tasks, canDragTask })` and render:

```jsx
<TaskCard key={task.id} task={task} draggable={!canDragTask || canDragTask(task)} />
```

Replace `front/src/pages/KanbanPage.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import { useAuth } from '../context/AuthContext';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskFormModal from '../components/kanban/TaskFormModal';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    tasksApi.listTasks().then(setTasks);
    projectsApi.listProjects().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(String(data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setMembers([]);
      return;
    }
    projectsApi.listMembers(selectedProjectId).then(setMembers);
  }, [selectedProjectId]);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const newStatus = over.id;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await tasksApi.updateTaskStatus(taskId, newStatus);
    } catch {
      tasksApi.listTasks().then(setTasks);
    }
  }

  function handleTaskCreated(task) {
    setTasks((prev) => [...prev, task]);
  }

  const visibleTasks = tasks.filter((t) => String(t.projectId) === String(selectedProjectId));

  function canDragTask(task) {
    return user.role === 'admin' || task.assigneeId === user.id;
  }

  return (
    <div className="p-6">
      {projects.length > 0 && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-md border border-input bg-card px-2 py-2 text-sm"
          >
            {projects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>
          {selectedProjectId && (
            <TaskFormModal projectId={selectedProjectId} users={members} onCreated={handleTaskCreated} />
          )}
        </div>
      )}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={visibleTasks.filter((t) => t.status === status)}
              canDragTask={canDragTask}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskCard.test.jsx src/components/kanban/TaskFormModal.test.jsx
```

Expected: PASS. Then `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/pages/KanbanPage.jsx front/src/pages/KanbanPage.test.jsx front/src/components/kanban/TaskCard.jsx front/src/components/kanban/TaskCard.test.jsx front/src/components/kanban/KanbanColumn.jsx
git commit -m "$(cat <<'EOF'
feat: scope Kanban to a project and let members create tasks

EOF
)"
```

---

### Task 11: Task detail historial

**Files:**
- Modify: `front/src/api/tasks.js`
- Modify: `front/src/pages/TaskDetailPage.jsx`
- Create: `front/src/pages/TaskDetailPage.test.jsx`

**Interfaces:**
- Consumes: `GET /tasks/:id/activities`.
- Produces: `listTaskActivities(taskId)` returns the array. Card title `Historial` **below** the notes card. Empty `Sin actividad`. Lines:
  - `created` → `{user.name} creó la tarea`
  - `status_changed` → `{user.name} movió {fromLabel} → {toLabel}`
  - Labels: `todo` → `To Do`, `in_progress` → `In Progress`, `review` → `Review`, `done` → `Done`.

- [ ] **Step 1: Write the failing test**

Create `front/src/pages/TaskDetailPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetailPage from './TaskDetailPage';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';

describe('TaskDetailPage', () => {
  it('renders created and status_changed activity lines', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 9, title: 'Build homepage', description: 'x', status: 'in_progress' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([
      { id: 1, type: 'created', fromStatus: null, toStatus: 'todo', user: { id: 1, name: 'Ada' } },
      {
        id: 2,
        type: 'status_changed',
        fromStatus: 'todo',
        toStatus: 'in_progress',
        user: { id: 2, name: 'Luis' },
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/tasks/9']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(tasksApi.listTaskActivities).toHaveBeenCalledWith('9');
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.getByText('Ada creó la tarea')).toBeInTheDocument();
    expect(screen.getByText('Luis movió To Do → In Progress')).toBeInTheDocument();
  });

  it('shows Sin actividad when there is no history', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([{ id: 9, title: 'Build homepage' }]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={['/tasks/9']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Sin actividad')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/TaskDetailPage.test.jsx
```

Expected: FAIL (`listTaskActivities` missing / no Historial).

- [ ] **Step 3: Write minimal implementation**

Append to `front/src/api/tasks.js`:

```javascript
export async function listTaskActivities(taskId) {
  const res = await api.get(`/tasks/${taskId}/activities`);
  return res.data;
}
```

In `TaskDetailPage.jsx`, add state `activities`, fetch `tasksApi.listTaskActivities(id)` in the existing `useEffect`, and after the notes `Card` add:

```jsx
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activities.map((item) => (
                <li key={item.id}>{formatActivity(item)}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
```

At the top of the same file (outside the component):

```javascript
const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

function formatActivity(item) {
  if (item.type === 'created') {
    return `${item.user.name} creó la tarea`;
  }
  const fromLabel = STATUS_LABELS[item.fromStatus] || item.fromStatus;
  const toLabel = STATUS_LABELS[item.toStatus] || item.toStatus;
  return `${item.user.name} movió ${fromLabel} → ${toLabel}`;
}
```

Initialize `const [activities, setActivities] = useState([]);` and in `useEffect` call `tasksApi.listTaskActivities(id).then(setActivities)`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/TaskDetailPage.test.jsx
npx vitest run
```

Expected: PASS (all frontend tests). Then:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/tasks.js front/src/pages/TaskDetailPage.jsx front/src/pages/TaskDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: show task creation and movement history

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| `ProjectMember` unique pair | 1 |
| Backfill from assignees, idempotent | 2 |
| `GET /projects` by membership; task without membership hidden | 3 |
| GET/POST/DELETE members; 409 duplicate; developer 403 write | 4 |
| `GET /tasks` all tasks on member projects; 403 foreign projectId | 5 |
| `TaskActivity` types `created` / `status_changed` | 6 |
| Member POST tasks; assign members only; created activity in transaction | 7 |
| PATCH writes move; no row if status unchanged; GET activities | 8 |
| Project detail Miembros admin vs read-only | 9 |
| Kanban selector both roles; filter; Nueva tarea; own-card drag | 10 |
| Historial copy + labels | 11 |
| Out of scope (files, costs, extra notes) | not planned |

No TBD/TODO placeholders. Names (`isProjectMember`, `memberProjectIds`, `listMembers`, `listTaskActivities`, `canDragTask`) are consistent across tasks.
