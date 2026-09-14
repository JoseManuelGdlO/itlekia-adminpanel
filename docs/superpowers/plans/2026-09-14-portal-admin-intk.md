# portal-admin-intk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full portal-admin-intk app: an Express/Sequelize/MySQL/JWT backend and a React/Vite/Tailwind/shadcn frontend implementing projects, a Kanban task board, user management, and a notes/reminders module that emails reminders.

**Architecture:** Two independent npm projects in one repo: `back/` (Express REST API, JWT auth via httpOnly cookie, Sequelize models synced directly — no migration files) and `front/` (Vite SPA consuming the API with credentials). Backend is built and tested first end-to-end via supertest; frontend is built after against the real API.

**Tech Stack:** Backend: Express, Sequelize, mysql2, sqlite3 (test only), jsonwebtoken, bcrypt, cookie-parser, nodemailer, node-cron, jest, supertest. Frontend: React, Vite, Tailwind, shadcn/ui, react-router-dom, axios, @dnd-kit/core, vitest, @testing-library/react.

## Global Constraints

- Data model, endpoints, and module scope come verbatim from `docs/superpowers/specs/2026-09-14-portal-admin-intk-design.md` — do not add fields or endpoints not listed there.
- Roles are exactly `admin` and `developer` — no client role.
- JWT lives in an httpOnly cookie named `token`, never in localStorage.
- Reminders are one-time only (no recurrence).
- Sequelize uses `sequelize.sync()` at startup (dev/prod) — no sequelize-cli migrations in this plan.
- Tests run against SQLite in-memory (`NODE_ENV=test`) so no real MySQL server is required to run the test suite; production/dev use MySQL.
- Every backend endpoint task must include a supertest test for both the success path and at least one auth/role-rejection path.

---

## Task 1: Backend project scaffold + health check

**Files:**
- Remove: root `package.json`, `package-lock.json`, `node_modules/` (misplaced shadcn devDependency; frontend will own its own shadcn install under `front/`)
- Create: `back/package.json`
- Create: `back/.env.example`
- Create: `back/.gitignore`
- Create: `back/src/app.js`
- Create: `back/src/server.js`
- Test: `back/tests/health.test.js`

**Interfaces:**
- Produces: `app.js` exports an Express app instance (`module.exports = app`) with no `.listen()` call, so tests can import it directly with supertest. `server.js` is the only file that calls `.listen()`.

- [ ] **Step 1: Clean up the stray root package**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
rm -rf node_modules package.json package-lock.json
```

- [ ] **Step 2: Create `back/` and initialize npm**

```bash
mkdir back
cd back
npm init -y
npm install express cookie-parser dotenv
npm install --save-dev jest supertest nodemon
```

- [ ] **Step 3: Set `back/package.json` scripts**

Edit `back/package.json` so the `"scripts"` key reads:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "test": "cross-env NODE_ENV=test jest --runInBand"
}
```

Install `cross-env` so `NODE_ENV=test` works on Windows too:

```bash
npm install --save-dev cross-env
```

- [ ] **Step 4: Create `back/.env.example`**

```env
PORT=4000
NODE_ENV=development
JWT_SECRET=change-me
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=portal_admin_intk
DB_USER=root
DB_PASSWORD=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=portal-admin-intk@example.com
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 5: Create `back/.gitignore`**

```
node_modules/
.env
*.sqlite
```

- [ ] **Step 6: Write the failing health check test**

`back/tests/health.test.js`:

```js
const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd back && npm test`
Expected: FAIL — `Cannot find module '../src/app'`

- [ ] **Step 8: Implement `back/src/app.js`**

```js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
```

- [ ] **Step 9: Implement `back/src/server.js`**

```js
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`portal-admin-intk backend listening on port ${PORT}`);
});
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd back && npm test`
Expected: PASS — 1 test passed

- [ ] **Step 11: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(back): scaffold express app with health check"
```

---

## Task 2: Sequelize setup + database config (MySQL dev/prod, SQLite in tests)

**Files:**
- Create: `back/src/config/database.js`
- Create: `back/src/models/index.js`
- Test: `back/tests/models/index.test.js`

**Interfaces:**
- Produces: `back/src/models/index.js` exports `{ sequelize, Sequelize }`. Every later model file does `const { sequelize, Sequelize } = require('./index')` — wait, models are defined *in* `index.js` in this plan (see Task 3+), so later tasks import individual model objects from `require('../models')`, e.g. `const { User } = require('../models')`.

- [ ] **Step 1: Install Sequelize and drivers**

```bash
cd back
npm install sequelize mysql2
npm install --save-dev sqlite3
```

- [ ] **Step 2: Create `back/src/config/database.js`**

```js
const isTest = process.env.NODE_ENV === 'test';

const config = isTest
  ? {
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    }
  : {
      dialect: 'mysql',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      logging: false,
    };

module.exports = config;
```

- [ ] **Step 3: Write the failing test for the Sequelize connection**

`back/tests/models/index.test.js`:

```js
const { sequelize } = require('../../src/models');

describe('database connection', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('authenticates successfully', async () => {
    await expect(sequelize.authenticate()).resolves.not.toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd back && npm test`
Expected: FAIL — `Cannot find module '../../src/models'`

- [ ] **Step 5: Implement `back/src/models/index.js` (base, models added in later tasks)**

```js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

module.exports = {
  sequelize,
  Sequelize,
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd back && npm test`
Expected: PASS — 2 tests passed (health + connection)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add sequelize connection config (mysql dev/prod, sqlite test)"
```

---

## Task 3: User model

**Files:**
- Create: `back/src/models/user.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/user.test.js`

**Interfaces:**
- Consumes: `sequelize`, `Sequelize` from `back/src/models/index.js` (Task 2).
- Produces: `User` model with fields `id, name, email, passwordHash, role ('admin'|'developer'), createdAt, updatedAt`. Exported as `models.User` from `back/src/models/index.js`. Later tasks import it as `const { User } = require('../models')`.

- [ ] **Step 1: Write the failing test**

`back/tests/models/user.test.js`:

```js
const { sequelize, User } = require('../../src/models');

describe('User model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a user with a valid role', async () => {
    const user = await User.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      passwordHash: 'hashed',
      role: 'admin',
    });
    expect(user.id).toBeDefined();
    expect(user.role).toBe('admin');
  });

  it('rejects an invalid role', async () => {
    await expect(
      User.create({
        name: 'Bad Role',
        email: 'bad@example.com',
        passwordHash: 'hashed',
        role: 'manager',
      })
    ).rejects.toThrow();
  });

  it('rejects a duplicate email', async () => {
    await User.create({
      name: 'First',
      email: 'dup@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
    await expect(
      User.create({
        name: 'Second',
        email: 'dup@example.com',
        passwordHash: 'hashed',
        role: 'developer',
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/models/user.test.js`
Expected: FAIL — `User` is undefined

- [ ] **Step 3: Implement `back/src/models/user.js`**

```js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM('admin', 'developer'),
      allowNull: false,
    },
  });

  return User;
};
```

- [ ] **Step 4: Wire it into `back/src/models/index.js`**

```js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);

module.exports = {
  sequelize,
  Sequelize,
  User,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd back && npm test tests/models/user.test.js`
Expected: PASS — 3 tests passed

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(back): add User model"
```

---

## Task 4: Project model

**Files:**
- Create: `back/src/models/project.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/project.test.js`

**Interfaces:**
- Produces: `Project` model with fields `id, name, description, status ('active'|'archived', default 'active'), createdAt, updatedAt`, exported as `models.Project`.

- [ ] **Step 1: Write the failing test**

`back/tests/models/project.test.js`:

```js
const { sequelize, Project } = require('../../src/models');

describe('Project model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a project defaulting to active status', async () => {
    const project = await Project.create({
      name: 'Website Revamp',
      description: 'Redesign the marketing site',
    });
    expect(project.status).toBe('active');
  });

  it('rejects an invalid status', async () => {
    await expect(
      Project.create({ name: 'Bad', status: 'paused' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/models/project.test.js`
Expected: FAIL — `Project` is undefined

- [ ] **Step 3: Implement `back/src/models/project.js`**

```js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Project = sequelize.define('Project', {
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
  });

  return Project;
};
```

- [ ] **Step 4: Wire it into `back/src/models/index.js`**

```js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd back && npm test tests/models/project.test.js`
Expected: PASS — 2 tests passed

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(back): add Project model"
```

---

## Task 5: Task model + associations with Project/User

**Files:**
- Create: `back/src/models/task.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/task.test.js`

**Interfaces:**
- Consumes: `Project` (Task 4), `User` (Task 3).
- Produces: `Task` model with fields `id, projectId, title, description, status ('todo'|'in_progress'|'review'|'done', default 'todo'), assigneeId (nullable), dueDate (nullable), createdAt, updatedAt`. Associations: `Project.hasMany(Task, {foreignKey: 'projectId', as: 'tasks'})`, `Task.belongsTo(Project, {foreignKey: 'projectId', as: 'project'})`, `User.hasMany(Task, {foreignKey: 'assigneeId', as: 'assignedTasks'})`, `Task.belongsTo(User, {foreignKey: 'assigneeId', as: 'assignee'})`. Exported as `models.Task`.

- [ ] **Step 1: Write the failing test**

`back/tests/models/task.test.js`:

```js
const { sequelize, Project, User, Task } = require('../../src/models');

describe('Task model', () => {
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

  it('creates a task defaulting to todo status, linked to a project', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Build homepage',
    });
    expect(task.status).toBe('todo');
    const withProject = await Task.findByPk(task.id, { include: 'project' });
    expect(withProject.project.name).toBe('Website Revamp');
  });

  it('assigns a task to a user via the assignee association', async () => {
    const task = await Task.create({
      projectId: project.id,
      title: 'Fix nav bug',
      assigneeId: developer.id,
    });
    const withAssignee = await Task.findByPk(task.id, { include: 'assignee' });
    expect(withAssignee.assignee.email).toBe('dev1@example.com');
  });

  it('rejects an invalid status', async () => {
    await expect(
      Task.create({ projectId: project.id, title: 'Bad', status: 'archived' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/models/task.test.js`
Expected: FAIL — `Task` is undefined

- [ ] **Step 3: Implement `back/src/models/task.js`**

```js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('todo', 'in_progress', 'review', 'done'),
      allowNull: false,
      defaultValue: 'todo',
    },
    dueDate: { type: DataTypes.DATE, allowNull: true },
  });

  return Task;
};
```

- [ ] **Step 4: Wire it into `back/src/models/index.js` with associations**

```js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);
const Task = require('./task')(sequelize);

Project.hasMany(Task, { foreignKey: 'projectId', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
  Task,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd back && npm test tests/models/task.test.js`
Expected: PASS — 3 tests passed

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(back): add Task model with Project/User associations"
```

---

## Task 6: Note model + associations with User/Project/Task

**Files:**
- Create: `back/src/models/note.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/note.test.js`

**Interfaces:**
- Consumes: `User` (Task 3), `Project` (Task 4), `Task` (Task 5).
- Produces: `Note` model with fields `id, userId, projectId (nullable), taskId (nullable), title, content, isReminder (default false), remindAt (nullable), notifiedAt (nullable), createdAt, updatedAt`. Associations: `User.hasMany(Note, {foreignKey:'userId', as:'notes'})`, `Note.belongsTo(User, {foreignKey:'userId', as:'owner'})`, `Project.hasMany(Note, {foreignKey:'projectId', as:'notes'})`, `Note.belongsTo(Project, {foreignKey:'projectId', as:'project'})`, `Task.hasMany(Note, {foreignKey:'taskId', as:'notes'})`, `Note.belongsTo(Task, {foreignKey:'taskId', as:'task'})`. A model-level validation rejects a Note with both `projectId` and `taskId` set. Exported as `models.Note`.

- [ ] **Step 1: Write the failing test**

`back/tests/models/note.test.js`:

```js
const { sequelize, User, Project, Task, Note } = require('../../src/models');

describe('Note model', () => {
  let owner;
  let project;
  let task;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    owner = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
    project = await Project.create({ name: 'Website Revamp' });
    task = await Task.create({ projectId: project.id, title: 'Build homepage' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a standalone note owned by a user', async () => {
    const note = await Note.create({
      userId: owner.id,
      title: 'Remember to follow up',
      content: 'Call the client about scope',
    });
    expect(note.isReminder).toBe(false);
    expect(note.projectId).toBeNull();
  });

  it('creates a note linked to a project', async () => {
    const note = await Note.create({
      userId: owner.id,
      projectId: project.id,
      title: 'Project kickoff notes',
      content: 'Discussed timeline',
    });
    expect(note.projectId).toBe(project.id);
  });

  it('creates a reminder note linked to a task with remindAt', async () => {
    const remindAt = new Date(Date.now() + 60000);
    const note = await Note.create({
      userId: owner.id,
      taskId: task.id,
      title: 'Ping client',
      content: 'Send status update',
      isReminder: true,
      remindAt,
    });
    expect(note.isReminder).toBe(true);
    expect(note.notifiedAt).toBeNull();
  });

  it('rejects a note linked to both a project and a task', async () => {
    await expect(
      Note.create({
        userId: owner.id,
        projectId: project.id,
        taskId: task.id,
        title: 'Invalid',
        content: 'Cannot link both',
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/models/note.test.js`
Expected: FAIL — `Note` is undefined

- [ ] **Step 3: Implement `back/src/models/note.js`**

```js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Note = sequelize.define(
    'Note',
    {
      title: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      isReminder: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      remindAt: { type: DataTypes.DATE, allowNull: true },
      notifiedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      validate: {
        notBothProjectAndTask() {
          if (this.projectId && this.taskId) {
            throw new Error('A note cannot be linked to both a project and a task');
          }
        },
      },
    }
  );

  return Note;
};
```

- [ ] **Step 4: Wire it into `back/src/models/index.js` with associations**

```js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config);

const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);
const Task = require('./task')(sequelize);
const Note = require('./note')(sequelize);

Project.hasMany(Task, { foreignKey: 'projectId', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

User.hasMany(Note, { foreignKey: 'userId', as: 'notes' });
Note.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

Project.hasMany(Note, { foreignKey: 'projectId', as: 'notes' });
Note.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Task.hasMany(Note, { foreignKey: 'taskId', as: 'notes' });
Note.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
  Task,
  Note,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd back && npm test tests/models/note.test.js`
Expected: PASS — 4 tests passed

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(back): add Note model with User/Project/Task associations"
```

---

## Task 7: Password + JWT utilities

**Files:**
- Create: `back/src/utils/password.js`
- Create: `back/src/utils/jwt.js`
- Test: `back/tests/utils/password.test.js`
- Test: `back/tests/utils/jwt.test.js`

**Interfaces:**
- Produces: `password.js` exports `{ hashPassword(plain): Promise<string>, comparePassword(plain, hash): Promise<boolean> }`. `jwt.js` exports `{ signToken({id, role}): string, verifyToken(token): {id, role} | throws }`.

- [ ] **Step 1: Install auth dependencies**

```bash
cd back
npm install bcrypt jsonwebtoken
```

- [ ] **Step 2: Write the failing tests**

`back/tests/utils/password.test.js`:

```js
const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('password utils', () => {
  it('hashes a password and verifies it matches', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash).not.toBe('correct-horse');
    await expect(comparePassword('correct-horse', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct-horse');
    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false);
  });
});
```

`back/tests/utils/jwt.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('jwt utils', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken({ id: 1, role: 'admin' });
    const payload = verifyToken(token);
    expect(payload.id).toBe(1);
    expect(payload.role).toBe('admin');
  });

  it('throws on a tampered token', () => {
    const token = signToken({ id: 1, role: 'admin' });
    expect(() => verifyToken(token + 'x')).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd back && npm test tests/utils`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement `back/src/utils/password.js`**

```js
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
```

- [ ] **Step 5: Implement `back/src/utils/jwt.js`**

```js
const jwt = require('jsonwebtoken');

function signToken({ id, role }) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd back && npm test tests/utils`
Expected: PASS — 4 tests passed

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add password hashing and jwt sign/verify utils"
```

---

## Task 8: Auth middleware (requireAuth, requireRole)

**Files:**
- Create: `back/src/middleware/auth.js`
- Test: `back/tests/middleware/auth.test.js`

**Interfaces:**
- Consumes: `verifyToken` from `back/src/utils/jwt.js` (Task 7).
- Produces: `{ requireAuth(req, res, next), requireRole(role) => (req, res, next) }`. `requireAuth` reads `req.cookies.token`, verifies it, sets `req.user = { id, role }`, calls `next()`, or responds 401. `requireRole(role)` must run after `requireAuth`; responds 403 if `req.user.role !== role`.

- [ ] **Step 1: Write the failing test**

`back/tests/middleware/auth.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { signToken } = require('../../src/utils/jwt');
const { requireAuth, requireRole } = require('../../src/middleware/auth');

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.get('/protected', requireAuth, (req, res) => res.json({ user: req.user }));
  app.get('/admin-only', requireAuth, requireRole('admin'), (req, res) =>
    res.json({ ok: true })
  );
  return app;
}

describe('auth middleware', () => {
  const app = buildApp();

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid token and exposes req.user', async () => {
    const token = signToken({ id: 5, role: 'developer' });
    const res = await request(app).get('/protected').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 5, role: 'developer' });
  });

  it('rejects a developer on an admin-only route', async () => {
    const token = signToken({ id: 5, role: 'developer' });
    const res = await request(app).get('/admin-only').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin on an admin-only route', async () => {
    const token = signToken({ id: 1, role: 'admin' });
    const res = await request(app).get('/admin-only').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/middleware/auth.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `back/src/middleware/auth.js`**

```js
const { verifyToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back && npm test tests/middleware/auth.test.js`
Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(back): add requireAuth/requireRole middleware"
```

---

## Task 9: Auth endpoints (login, logout, me)

**Files:**
- Create: `back/src/controllers/authController.js`
- Create: `back/src/routes/auth.js`
- Modify: `back/src/app.js`
- Test: `back/tests/routes/auth.test.js`

**Interfaces:**
- Consumes: `User` model (Task 3), `comparePassword` (Task 7), `signToken` (Task 7), `requireAuth` (Task 8).
- Produces: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, mounted in `app.js` under no prefix (routes already include `/auth/...`). Login sets cookie `token` (httpOnly, sameSite 'lax', secure only when `NODE_ENV === 'production'`) and returns `{ id, name, email, role }`. `/auth/me` returns the same shape for the authenticated user.

- [ ] **Step 1: Write the failing test**

`back/tests/routes/auth.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');

describe('auth routes', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'admin',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('logs in with correct credentials and sets a token cookie', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@example.com');
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('rejects wrong credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns the current user from /auth/me when authenticated', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'secret123' });
    const cookie = login.headers['set-cookie'][0];

    const res = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@example.com');
  });

  it('rejects /auth/me with no cookie', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/routes/auth.test.js`
Expected: FAIL — 404s, routes not mounted

- [ ] **Step 3: Implement `back/src/controllers/authController.js`**

```js
const { User } = require('../models');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function setTokenCookie(res, user) {
  const token = signToken({ id: user.id, role: user.role });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  setTokenCookie(res, user);
  return res.json(toPublicUser(user));
}

async function logout(req, res) {
  res.clearCookie('token');
  return res.status(204).send();
}

async function me(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json(toPublicUser(user));
}

module.exports = { login, logout, me, toPublicUser };
```

- [ ] **Step 4: Implement `back/src/routes/auth.js`**

```js
const express = require('express');
const { login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
```

- [ ] **Step 5: Mount the router in `back/src/app.js`**

```js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);

module.exports = app;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd back && npm test tests/routes/auth.test.js`
Expected: PASS — 4 tests passed

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add /auth/login, /auth/logout, /auth/me endpoints"
```

---

## Task 10: Users endpoints (admin only)

**Files:**
- Create: `back/src/controllers/usersController.js`
- Create: `back/src/routes/users.js`
- Modify: `back/src/app.js`
- Test: `back/tests/routes/users.test.js`

**Interfaces:**
- Consumes: `User` model (Task 3), `hashPassword` (Task 7), `requireAuth`/`requireRole` (Task 8), `toPublicUser` (Task 9).
- Produces: `GET /users`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id`, all admin-only, mounted at `/users`.

- [ ] **Step 1: Write the failing test**

`back/tests/routes/users.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');
const { signToken } = require('../../src/utils/jwt');

describe('users routes', () => {
  let adminCookie;
  let developerCookie;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'admin',
    });
    const developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'developer',
    });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('lists users for an admin', async () => {
    const res = await request(app).get('/users').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].passwordHash).toBeUndefined();
  });

  it('rejects listing users for a developer', async () => {
    const res = await request(app).get('/users').set('Cookie', developerCookie);
    expect(res.status).toBe(403);
  });

  it('creates a new developer as admin', async () => {
    const res = await request(app)
      .post('/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Dev Two', email: 'dev2@example.com', password: 'secret123', role: 'developer' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('dev2@example.com');
  });

  it('updates a user as admin', async () => {
    const created = await User.create({
      name: 'Temp',
      email: 'temp@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'developer',
    });
    const res = await request(app)
      .put(`/users/${created.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('deletes a user as admin', async () => {
    const created = await User.create({
      name: 'ToDelete',
      email: 'delete@example.com',
      passwordHash: await hashPassword('secret123'),
      role: 'developer',
    });
    const res = await request(app).delete(`/users/${created.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
    expect(await User.findByPk(created.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/routes/users.test.js`
Expected: FAIL — 404s

- [ ] **Step 3: Implement `back/src/controllers/usersController.js`**

```js
const { User } = require('../models');
const { hashPassword } = require('../utils/password');
const { toPublicUser } = require('./authController');

async function list(req, res) {
  const users = await User.findAll({ order: [['id', 'ASC']] });
  return res.json(users.map(toPublicUser));
}

async function create(req, res) {
  const { name, email, password, role } = req.body;
  const user = await User.create({
    name,
    email,
    role,
    passwordHash: await hashPassword(password),
  });
  return res.status(201).json(toPublicUser(user));
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { name, email, role, password } = req.body;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (password) user.passwordHash = await hashPassword(password);
  await user.save();
  return res.json(toPublicUser(user));
}

async function remove(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  await user.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
```

- [ ] **Step 4: Implement `back/src/routes/users.js`**

```js
const express = require('express');
const controller = require('../controllers/usersController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
```

- [ ] **Step 5: Mount the router in `back/src/app.js`**

Add near the other route mounts:

```js
const usersRoutes = require('./routes/users');
// ...
app.use('/users', usersRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd back && npm test tests/routes/users.test.js`
Expected: PASS — 5 tests passed

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add admin-only users CRUD endpoints"
```

---

## Task 11: Projects endpoints (admin CRUD, developer scoped read)

**Files:**
- Create: `back/src/controllers/projectsController.js`
- Create: `back/src/routes/projects.js`
- Modify: `back/src/app.js`
- Test: `back/tests/routes/projects.test.js`

**Interfaces:**
- Consumes: `Project`, `Task` models (Tasks 4-5), `requireAuth`/`requireRole` (Task 8).
- Produces: `GET /projects` (admin: all; developer: only projects where they have an assigned task), `POST /projects`, `PUT /projects/:id`, `DELETE /projects/:id` (all three admin-only), mounted at `/projects`.

- [ ] **Step 1: Write the failing test**

`back/tests/routes/projects.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('projects routes', () => {
  let adminCookie;
  let developerCookie;
  let assignedProject;
  let otherProject;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;

    assignedProject = await Project.create({ name: 'Assigned Project' });
    otherProject = await Project.create({ name: 'Other Project' });
    await Task.create({ projectId: assignedProject.id, title: 'A task', assigneeId: developer.id });
    await Task.create({ projectId: otherProject.id, title: 'Not mine' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('admin sees all projects', async () => {
    const res = await request(app).get('/projects').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('developer only sees projects with tasks assigned to them', async () => {
    const res = await request(app).get('/projects').set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Assigned Project');
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/routes/projects.test.js`
Expected: FAIL — 404s

- [ ] **Step 3: Implement `back/src/controllers/projectsController.js`**

```js
const { Project, Task } = require('../models');

async function list(req, res) {
  if (req.user.role === 'admin') {
    const projects = await Project.findAll({ order: [['id', 'ASC']] });
    return res.json(projects);
  }

  const assignedTasks = await Task.findAll({
    where: { assigneeId: req.user.id },
    attributes: ['projectId'],
  });
  const projectIds = [...new Set(assignedTasks.map((t) => t.projectId))];
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

- [ ] **Step 4: Implement `back/src/routes/projects.js`**

```js
const express = require('express');
const controller = require('../controllers/projectsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('admin'), controller.create);
router.put('/:id', requireRole('admin'), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
```

- [ ] **Step 5: Mount the router in `back/src/app.js`**

```js
const projectsRoutes = require('./routes/projects');
// ...
app.use('/projects', projectsRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd back && npm test tests/routes/projects.test.js`
Expected: PASS — 5 tests passed

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add projects endpoints with role-scoped listing"
```

---

## Task 12: Tasks endpoints (CRUD + status transition)

**Files:**
- Create: `back/src/controllers/tasksController.js`
- Create: `back/src/routes/tasks.js`
- Modify: `back/src/app.js`
- Test: `back/tests/routes/tasks.test.js`

**Interfaces:**
- Consumes: `Task`, `Project`, `User` models, `requireAuth`/`requireRole` (Task 8).
- Produces: `GET /tasks` (query params `projectId`, `assigneeId`; developer requests are always forced to their own `assigneeId` regardless of query), `POST /tasks` (admin only), `PUT /tasks/:id` (admin: all fields; developer: only if they are the assignee, and only `description` is applied — other fields in the body are ignored), `PATCH /tasks/:id/status` (admin, or the assignee developer), `DELETE /tasks/:id` (admin only).

- [ ] **Step 1: Write the failing test**

`back/tests/routes/tasks.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, Task } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('tasks routes', () => {
  let adminCookie;
  let developerCookie;
  let otherDeveloperCookie;
  let project;
  let assignedTask;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    const otherDeveloper = await User.create({ name: 'Dev2', email: 'dev2@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    otherDeveloperCookie = `token=${signToken({ id: otherDeveloper.id, role: 'developer' })}`;

    project = await Project.create({ name: 'Website Revamp' });
    assignedTask = await Task.create({ projectId: project.id, title: 'Build homepage', assigneeId: developer.id });
    await Task.create({ projectId: project.id, title: 'Not assigned to dev' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('developer listing tasks only sees their own regardless of query params', async () => {
    const res = await request(app)
      .get(`/tasks?projectId=${project.id}`)
      .set('Cookie', developerCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(assignedTask.id);
  });

  it('admin creates a task', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'New task' });
    expect(res.status).toBe(201);
  });

  it('developer cannot create a task', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', developerCookie)
      .send({ projectId: project.id, title: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('assignee can PATCH the status of their task', async () => {
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/status`)
      .set('Cookie', developerCookie)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('a different developer cannot PATCH the status of a task not assigned to them', async () => {
    const res = await request(app)
      .patch(`/tasks/${assignedTask.id}/status`)
      .set('Cookie', otherDeveloperCookie)
      .send({ status: 'done' });
    expect(res.status).toBe(403);
  });

  it('assignee PUT only applies the description field, ignoring others', async () => {
    const res = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', developerCookie)
      .send({ description: 'Updated details', title: 'Hijacked title' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated details');
    expect(res.body.title).toBe('Build homepage');
  });

  it('admin deletes a task', async () => {
    const toDelete = await Task.create({ projectId: project.id, title: 'Temp' });
    const res = await request(app).delete(`/tasks/${toDelete.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/routes/tasks.test.js`
Expected: FAIL — 404s

- [ ] **Step 3: Implement `back/src/controllers/tasksController.js`**

```js
const { Task } = require('../models');

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];

async function list(req, res) {
  const where = {};
  if (req.user.role === 'admin') {
    if (req.query.projectId) where.projectId = req.query.projectId;
    if (req.query.assigneeId) where.assigneeId = req.query.assigneeId;
  } else {
    where.assigneeId = req.user.id;
    if (req.query.projectId) where.projectId = req.query.projectId;
  }
  const tasks = await Task.findAll({ where, order: [['id', 'ASC']] });
  return res.json(tasks);
}

async function create(req, res) {
  const { projectId, title, description, assigneeId, dueDate } = req.body;
  const task = await Task.create({ projectId, title, description, assigneeId, dueDate });
  return res.status(201).json(task);
}

async function update(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (req.user.role === 'admin') {
    const { title, description, assigneeId, dueDate, projectId } = req.body;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (assigneeId !== undefined) task.assigneeId = assigneeId;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (projectId !== undefined) task.projectId = projectId;
  } else {
    if (task.assigneeId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.body.description !== undefined) task.description = req.body.description;
  }

  await task.save();
  return res.json(task);
}

async function updateStatus(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (req.user.role !== 'admin' && task.assigneeId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  task.status = status;
  await task.save();
  return res.json(task);
}

async function remove(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  await task.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, updateStatus, remove };
```

- [ ] **Step 4: Implement `back/src/routes/tasks.js`**

```js
const express = require('express');
const controller = require('../controllers/tasksController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('admin'), controller.create);
router.put('/:id', controller.update);
router.patch('/:id/status', controller.updateStatus);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
```

- [ ] **Step 5: Mount the router in `back/src/app.js`**

```js
const tasksRoutes = require('./routes/tasks');
// ...
app.use('/tasks', tasksRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd back && npm test tests/routes/tasks.test.js`
Expected: PASS — 7 tests passed

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add tasks endpoints with role-scoped access and status patch"
```

---

## Task 13: Notes endpoints (owner-scoped CRUD)

**Files:**
- Create: `back/src/controllers/notesController.js`
- Create: `back/src/routes/notes.js`
- Modify: `back/src/app.js`
- Test: `back/tests/routes/notes.test.js`

**Interfaces:**
- Consumes: `Note` model (Task 6), `requireAuth` (Task 8).
- Produces: `GET /notes` (query params `projectId`, `taskId`; always forced to `userId = req.user.id`), `POST /notes` (forces `userId = req.user.id`; rejects a body with both `projectId` and `taskId`; rejects `isReminder: true` without `remindAt`), `PUT /notes/:id` (owner only), `DELETE /notes/:id` (owner only).

- [ ] **Step 1: Write the failing test**

`back/tests/routes/notes.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Note } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('notes routes', () => {
  let ownerCookie;
  let otherCookie;
  let owner;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    owner = await User.create({ name: 'Owner', email: 'owner@example.com', passwordHash: 'x', role: 'developer' });
    const other = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: 'x', role: 'developer' });
    ownerCookie = `token=${signToken({ id: owner.id, role: 'developer' })}`;
    otherCookie = `token=${signToken({ id: other.id, role: 'developer' })}`;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a standalone note for the authenticated user', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Remember', content: 'Follow up with client' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(owner.id);
  });

  it('rejects a note linked to both a project and a task', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Bad', content: 'x', projectId: 1, taskId: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects a reminder note with no remindAt', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Bad reminder', content: 'x', isReminder: true });
    expect(res.status).toBe(400);
  });

  it('creates a valid reminder note', async () => {
    const remindAt = new Date(Date.now() + 60000).toISOString();
    const res = await request(app)
      .post('/notes')
      .set('Cookie', ownerCookie)
      .send({ title: 'Ping client', content: 'x', isReminder: true, remindAt });
    expect(res.status).toBe(201);
    expect(res.body.isReminder).toBe(true);
  });

  it('only lists notes owned by the requesting user', async () => {
    await Note.create({ userId: owner.id, title: 'Owner note', content: 'x' });
    const res = await request(app).get('/notes').set('Cookie', otherCookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('rejects updating a note owned by someone else', async () => {
    const note = await Note.create({ userId: owner.id, title: 'Owner note 2', content: 'x' });
    const res = await request(app)
      .put(`/notes/${note.id}`)
      .set('Cookie', otherCookie)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('owner can update and delete their note', async () => {
    const note = await Note.create({ userId: owner.id, title: 'Owner note 3', content: 'x' });
    const putRes = await request(app)
      .put(`/notes/${note.id}`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Updated' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.title).toBe('Updated');

    const deleteRes = await request(app).delete(`/notes/${note.id}`).set('Cookie', ownerCookie);
    expect(deleteRes.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test tests/routes/notes.test.js`
Expected: FAIL — 404s

- [ ] **Step 3: Implement `back/src/controllers/notesController.js`**

```js
const { Note } = require('../models');

async function list(req, res) {
  const where = { userId: req.user.id };
  if (req.query.projectId) where.projectId = req.query.projectId;
  if (req.query.taskId) where.taskId = req.query.taskId;
  const notes = await Note.findAll({ where, order: [['id', 'DESC']] });
  return res.json(notes);
}

async function create(req, res) {
  const { title, content, projectId, taskId, isReminder, remindAt } = req.body;

  if (projectId && taskId) {
    return res.status(400).json({ error: 'A note cannot be linked to both a project and a task' });
  }
  if (isReminder && !remindAt) {
    return res.status(400).json({ error: 'A reminder note requires remindAt' });
  }

  const note = await Note.create({
    userId: req.user.id,
    title,
    content,
    projectId: projectId || null,
    taskId: taskId || null,
    isReminder: !!isReminder,
    remindAt: isReminder ? remindAt : null,
  });
  return res.status(201).json(note);
}

async function update(req, res) {
  const note = await Note.findByPk(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }
  if (note.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, content, isReminder, remindAt } = req.body;
  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;
  if (isReminder !== undefined) note.isReminder = isReminder;
  if (remindAt !== undefined) note.remindAt = remindAt;

  if (note.isReminder && !note.remindAt) {
    return res.status(400).json({ error: 'A reminder note requires remindAt' });
  }

  await note.save();
  return res.json(note);
}

async function remove(req, res) {
  const note = await Note.findByPk(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }
  if (note.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await note.destroy();
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
```

- [ ] **Step 4: Implement `back/src/routes/notes.js`**

```js
const express = require('express');
const controller = require('../controllers/notesController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
```

- [ ] **Step 5: Mount the router in `back/src/app.js`**

```js
const notesRoutes = require('./routes/notes');
// ...
app.use('/notes', notesRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd back && npm test tests/routes/notes.test.js`
Expected: PASS — 7 tests passed

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add owner-scoped notes CRUD endpoints"
```

---

## Task 14: Email utility (Nodemailer)

**Files:**
- Create: `back/src/utils/mailer.js`
- Test: `back/tests/utils/mailer.test.js`

**Interfaces:**
- Produces: `{ sendReminderEmail({ to, note }): Promise<void> }`. Internally builds a Nodemailer transporter from `SMTP_HOST/PORT/USER/PASS/FROM` env vars, lazily on first call so tests can inject a fake transporter.
- For testability, the transporter factory is exposed separately: `module.exports.__setTransporterForTests(transporter)` lets tests swap in a mock without hitting a real SMTP server.

- [ ] **Step 1: Install nodemailer**

```bash
cd back
npm install nodemailer
```

- [ ] **Step 2: Write the failing test**

`back/tests/utils/mailer.test.js`:

```js
const { sendReminderEmail, __setTransporterForTests } = require('../../src/utils/mailer');

describe('mailer', () => {
  it('sends a reminder email with the note title in the subject', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    __setTransporterForTests({ sendMail });

    await sendReminderEmail({
      to: 'dev@example.com',
      note: { title: 'Ping client', content: 'Send status update' },
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@example.com',
        subject: expect.stringContaining('Ping client'),
      })
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd back && npm test tests/utils/mailer.test.js`
Expected: FAIL — module not found

- [ ] **Step 4: Implement `back/src/utils/mailer.js`**

```js
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function __setTransporterForTests(fakeTransporter) {
  transporter = fakeTransporter;
}

async function sendReminderEmail({ to, note }) {
  const client = getTransporter();
  await client.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Recordatorio: ${note.title}`,
    text: note.content,
  });
}

module.exports = { sendReminderEmail, __setTransporterForTests };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd back && npm test tests/utils/mailer.test.js`
Expected: PASS — 1 test passed

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(back): add nodemailer reminder email utility"
```

---

## Task 15: Reminder cron job

**Files:**
- Create: `back/src/jobs/reminderJob.js`
- Modify: `back/src/server.js`
- Test: `back/tests/jobs/reminderJob.test.js`

**Interfaces:**
- Consumes: `Note`, `User` models, `sendReminderEmail` (Task 14).
- Produces: `{ checkAndSendReminders(): Promise<number> }` (returns count of reminders sent) as the testable core logic, plus `startReminderJob()` which schedules `checkAndSendReminders` with `node-cron` every minute — only `startReminderJob` touches node-cron, so the core logic is testable without waiting on a real schedule.

- [ ] **Step 1: Install node-cron**

```bash
cd back
npm install node-cron
```

- [ ] **Step 2: Write the failing test**

`back/tests/jobs/reminderJob.test.js`:

```js
const { sequelize, User, Note } = require('../../src/models');
const mailer = require('../../src/utils/mailer');
const { checkAndSendReminders } = require('../../src/jobs/reminderJob');

describe('checkAndSendReminders', () => {
  let user;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    user = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('sends an email for a due reminder and marks it notified', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });

    const due = await Note.create({
      userId: user.id,
      title: 'Ping client',
      content: 'Send status update',
      isReminder: true,
      remindAt: new Date(Date.now() - 1000),
    });

    const sentCount = await checkAndSendReminders();

    expect(sentCount).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    await due.reload();
    expect(due.notifiedAt).not.toBeNull();
  });

  it('does not resend an already-notified reminder', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });

    await checkAndSendReminders();

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('ignores reminders not yet due', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });

    await Note.create({
      userId: user.id,
      title: 'Future reminder',
      content: 'Not yet',
      isReminder: true,
      remindAt: new Date(Date.now() + 60000),
    });

    const sentCount = await checkAndSendReminders();

    expect(sentCount).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd back && npm test tests/jobs/reminderJob.test.js`
Expected: FAIL — module not found

- [ ] **Step 4: Implement `back/src/jobs/reminderJob.js`**

```js
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Note, User } = require('../models');
const { sendReminderEmail } = require('../utils/mailer');

async function checkAndSendReminders() {
  const dueNotes = await Note.findAll({
    where: {
      isReminder: true,
      remindAt: { [Op.lte]: new Date() },
      notifiedAt: null,
    },
    include: { model: User, as: 'owner' },
  });

  for (const note of dueNotes) {
    await sendReminderEmail({ to: note.owner.email, note });
    note.notifiedAt = new Date();
    await note.save();
  }

  return dueNotes.length;
}

function startReminderJob() {
  cron.schedule('* * * * *', () => {
    checkAndSendReminders().catch((err) => {
      console.error('Reminder job failed:', err);
    });
  });
}

module.exports = { checkAndSendReminders, startReminderJob };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd back && npm test tests/jobs/reminderJob.test.js`
Expected: PASS — 3 tests passed

- [ ] **Step 6: Wire the job into `back/src/server.js`**

```js
const app = require('./app');
const { sequelize } = require('./models');
const { startReminderJob } = require('./jobs/reminderJob');

const PORT = process.env.PORT || 4000;

async function main() {
  await sequelize.sync();
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`portal-admin-intk backend listening on port ${PORT}`);
  });
}

main();
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(back): add reminder cron job and wire sync+job into server startup"
```

---

## Task 16: CORS + seed script for first admin user

**Files:**
- Modify: `back/src/app.js`
- Create: `back/scripts/seedAdmin.js`
- Modify: `back/package.json` (add `seed` script)

**Interfaces:**
- Produces: CORS enabled for `CORS_ORIGIN` with credentials, so the frontend (Task 18+) can send/receive the httpOnly cookie cross-origin during local dev (front on :5173, back on :4000). `scripts/seedAdmin.js` is a one-off Node script (not a test target) that creates the first admin user if none exists yet.

- [ ] **Step 1: Install cors**

```bash
cd back
npm install cors
```

- [ ] **Step 2: Add CORS middleware to `back/src/app.js`**

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const projectsRoutes = require('./routes/projects');
const tasksRoutes = require('./routes/tasks');
const notesRoutes = require('./routes/notes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/projects', projectsRoutes);
app.use('/tasks', tasksRoutes);
app.use('/notes', notesRoutes);

module.exports = app;
```

- [ ] **Step 3: Create `back/scripts/seedAdmin.js`**

```js
require('dotenv').config();
const { sequelize, User } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

async function main() {
  await sequelize.sync();

  const existingAdmin = await User.findOne({ where: { role: 'admin' } });
  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.email}`);
    process.exit(0);
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@portal-admin-intk.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'change-me-now';

  await User.create({
    name: 'Admin',
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
  });

  console.log(`Created admin user: ${email} / ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Add the `seed` script to `back/package.json`**

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "test": "cross-env NODE_ENV=test jest --runInBand",
  "seed": "node scripts/seedAdmin.js"
}
```

- [ ] **Step 5: Run the full backend test suite to confirm nothing broke**

Run: `cd back && npm test`
Expected: PASS — all backend tests passing (health, models x4, utils x2, middleware, routes x4, mailer, reminderJob)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(back): add CORS support and first-admin seed script"
```

---

**Backend is now feature-complete per the spec.** Manually verify before moving to frontend:

```bash
cd back
cp .env.example .env
# edit .env with real MySQL credentials and SMTP creds
npm run seed
npm run dev
```

Confirm `curl http://localhost:4000/health` returns `{"status":"ok"}`, and `curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@portal-admin-intk.local\",\"password\":\"change-me-now\"}"` returns the admin user with a `Set-Cookie` header.

---

## Task 17: Frontend scaffold (Vite + Tailwind + shadcn/ui + API client)

**Files:**
- Create: `front/` (via Vite)
- Create: `front/src/api/client.js`
- Create: `front/.env.development`
- Test: `front/src/api/client.test.js`

**Interfaces:**
- Produces: `front/src/api/client.js` exports a configured `axios` instance (`baseURL` from `VITE_API_URL`, `withCredentials: true` so the httpOnly cookie is sent). Every later API wrapper module does `import api from './client'`.

- [ ] **Step 1: Scaffold Vite with the React template**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
npm create vite@latest front -- --template react
cd front
npm install
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install axios react-router-dom @dnd-kit/core @dnd-kit/sortable
```

- [ ] **Step 3: Install and configure Tailwind**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Edit `front/tailwind.config.js`:

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

Replace the contents of `front/src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input card dialog dropdown-menu select badge label textarea
```

- [ ] **Step 5: Install test tooling**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `front/package.json` `"scripts"`:

```json
"test": "vitest run"
```

Create `front/vitest.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
```

Create `front/src/setupTests.js`:

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Create `front/.env.development`**

```env
VITE_API_URL=http://localhost:4000
```

- [ ] **Step 7: Write the failing test for the API client**

`front/src/api/client.test.js`:

```js
import { describe, it, expect } from 'vitest';
import api from './client';

describe('api client', () => {
  it('is configured with withCredentials so the auth cookie is sent', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — module not found

- [ ] **Step 9: Implement `front/src/api/client.js`**

```js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

export default api;
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 1 test passed

- [ ] **Step 11: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): scaffold vite+react+tailwind+shadcn app with api client"
```

---

## Task 18: Auth context + Login page + protected routing

**Files:**
- Create: `front/src/api/auth.js`
- Create: `front/src/context/AuthContext.jsx`
- Create: `front/src/components/ProtectedRoute.jsx`
- Create: `front/src/pages/LoginPage.jsx`
- Create: `front/src/App.jsx` (replaces Vite default)
- Test: `front/src/context/AuthContext.test.jsx`

**Interfaces:**
- Consumes: `api` from `front/src/api/client.js` (Task 17).
- Produces: `front/src/api/auth.js` exports `{ login({email, password}), logout(), me() }` (each returns `res.data` or throws on non-2xx). `AuthContext` exports `AuthProvider` and `useAuth()` returning `{ user, loading, login(email, password), logout() }`, where `user` is `null` when unauthenticated or `{ id, name, email, role }` when authenticated. `ProtectedRoute` takes an optional `role` prop and redirects to `/login` if `user` is null, or to `/` if `role` is set and doesn't match `user.role`.

- [ ] **Step 1: Write the failing test**

`front/src/context/AuthContext.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as authApi from '../api/auth';

function Probe() {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'anonymous'}</div>
      <button onClick={() => login('admin@example.com', 'secret123')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts anonymous when /auth/me fails, then logs in and out', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValueOnce(new Error('not authenticated'));
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({ id: 1, email: 'admin@example.com', role: 'admin' });
    vi.spyOn(authApi, 'logout').mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('anonymous'));

    await act(async () => {
      screen.getByText('login').click();
    });
    expect(screen.getByTestId('user').textContent).toBe('admin@example.com');

    await act(async () => {
      screen.getByText('logout').click();
    });
    expect(screen.getByTestId('user').textContent).toBe('anonymous');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `front/src/api/auth.js`**

```js
import api from './client';

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function me() {
  const res = await api.get('/auth/me');
  return res.data;
}
```

- [ ] **Step 4: Implement `front/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const loggedInUser = await authApi.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 1 test passed

- [ ] **Step 6: Implement `front/src/components/ProtectedRoute.jsx`**

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
```

- [ ] **Step 7: Implement `front/src/pages/LoginPage.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Email o contraseña incorrectos');
    }
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-80 space-y-4 rounded border p-6">
        <h1 className="text-xl font-semibold">Portal Admin</h1>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">
          Ingresar
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Implement `front/src/App.jsx` with routing**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

Create a placeholder `front/src/pages/DashboardPage.jsx` (fleshed out in Task 19):

```jsx
export default function DashboardPage() {
  return <div className="p-6">Dashboard</div>;
}
```

- [ ] **Step 9: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): add auth context, login page, and protected routing"
```

---

## Task 19: App shell with role-based navigation + full routing

**Files:**
- Create: `front/src/components/AppShell.jsx`
- Modify: `front/src/App.jsx`
- Modify: `front/src/pages/DashboardPage.jsx`
- Test: `front/src/components/AppShell.test.jsx`

**Interfaces:**
- Produces: `AppShell` renders a sidebar nav plus `<Outlet />` for nested routes. Nav links: `Dashboard`, `Kanban` (both roles), `Proyectos`, `Usuarios` (admin only), `Notas y Recordatorios` (both roles), and a `Logout` button. `App.jsx` nests all authenticated routes (`/`, `/kanban`, `/projects`, `/users`, `/notes`) under one `ProtectedRoute` + `AppShell` layout route.

- [ ] **Step 1: Write the failing test**

`front/src/components/AppShell.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from './AppShell';
import { AuthContext } from '../context/AuthContext';

function renderWithUser(role) {
  const AuthContextMock = AuthContext;
  return render(
    <AuthContextMock.Provider value={{ user: { id: 1, name: 'Test', role }, loading: false, logout: vi.fn() }}>
      <MemoryRouter>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    </AuthContextMock.Provider>
  );
}

describe('AppShell', () => {
  it('shows the Usuarios link for admins', () => {
    renderWithUser('admin');
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('hides the Usuarios link for developers', () => {
    renderWithUser('developer');
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Export `AuthContext` itself from `front/src/context/AuthContext.jsx`**

Add `export` to the existing `const AuthContext = createContext(null);` line so it reads:

```js
export const AuthContext = createContext(null);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — `AppShell` module not found

- [ ] **Step 4: Implement `front/src/components/AppShell.jsx`**

```jsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'developer'] },
  { to: '/kanban', label: 'Kanban', roles: ['admin', 'developer'] },
  { to: '/projects', label: 'Proyectos', roles: ['admin', 'developer'] },
  { to: '/users', label: 'Usuarios', roles: ['admin'] },
  { to: '/notes', label: 'Notas y Recordatorios', roles: ['admin', 'developer'] },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4 space-y-2">
        <p className="mb-4 font-semibold">Portal Admin</p>
        {NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded px-2 py-1 text-sm ${isActive ? 'bg-gray-200' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <Button variant="outline" className="mt-4 w-full" onClick={() => logout()}>
          Logout
        </Button>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 2 tests passed

- [ ] **Step 6: Update `front/src/pages/DashboardPage.jsx`**

```jsx
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <p className="text-sm text-gray-600">
        {user.role === 'admin'
          ? 'Tienes acceso completo a proyectos, tareas, usuarios y notas.'
          : 'Aquí verás un resumen de tus tareas asignadas.'}
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Wire full routing into `front/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import UsersPage from './pages/UsersPage';
import KanbanPage from './pages/KanbanPage';
import NotesPage from './pages/NotesPage';

function AuthenticatedLayout({ children, role }) {
  return (
    <ProtectedRoute role={role}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AuthenticatedLayout><DashboardPage /></AuthenticatedLayout>} />
          <Route path="/kanban" element={<AuthenticatedLayout><KanbanPage /></AuthenticatedLayout>} />
          <Route path="/projects" element={<AuthenticatedLayout><ProjectsPage /></AuthenticatedLayout>} />
          <Route path="/users" element={<AuthenticatedLayout role="admin"><UsersPage /></AuthenticatedLayout>} />
          <Route path="/notes" element={<AuthenticatedLayout><NotesPage /></AuthenticatedLayout>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

Note: `ProjectsPage`, `UsersPage`, `KanbanPage`, `NotesPage` are placeholders until Tasks 20-23 implement them — create minimal stubs now so the app compiles:

`front/src/pages/ProjectsPage.jsx`, `front/src/pages/UsersPage.jsx`, `front/src/pages/KanbanPage.jsx`, `front/src/pages/NotesPage.jsx`, each with this shape (substitute the title):

```jsx
export default function ProjectsPage() {
  return <div className="p-6">Proyectos (pendiente)</div>;
}
```

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): add role-based app shell nav and full route tree"
```

---

## Task 20: Users page (admin CRUD UI)

**Files:**
- Create: `front/src/api/users.js`
- Create: `front/src/pages/UsersPage.jsx` (replaces stub)
- Test: `front/src/pages/UsersPage.test.jsx`

**Interfaces:**
- Consumes: `api` (Task 17).
- Produces: `front/src/api/users.js` exports `{ listUsers(), createUser(data), updateUser(id, data), deleteUser(id) }`.

- [ ] **Step 1: Write the failing test**

`front/src/pages/UsersPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import UsersPage from './UsersPage';
import * as usersApi from '../api/users';

describe('UsersPage', () => {
  it('lists users fetched from the API', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValueOnce([
      { id: 1, name: 'Ada', email: 'ada@example.com', role: 'admin' },
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
    ]);

    render(<UsersPage />);

    await waitFor(() => expect(screen.getByText('ada@example.com')).toBeInTheDocument());
    expect(screen.getByText('dev1@example.com')).toBeInTheDocument();
  });

  it('creates a user and adds it to the list', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValueOnce([]);
    vi.spyOn(usersApi, 'createUser').mockResolvedValueOnce({
      id: 3, name: 'New Dev', email: 'new@example.com', role: 'developer',
    });

    render(<UsersPage />);
    await waitFor(() => expect(usersApi.listUsers).toHaveBeenCalled());

    await act(async () => {
      screen.getByLabelText('Nombre').value = 'New Dev';
      screen.getByLabelText('Nombre').dispatchEvent(new Event('input', { bubbles: true }));
      screen.getByLabelText('Email').value = 'new@example.com';
      screen.getByLabelText('Email').dispatchEvent(new Event('input', { bubbles: true }));
      screen.getByLabelText('Password').value = 'secret123';
      screen.getByLabelText('Password').dispatchEvent(new Event('input', { bubbles: true }));
      screen.getByText('Crear usuario').click();
    });

    await waitFor(() => expect(screen.getByText('new@example.com')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `front/src/api/users.js`**

```js
import api from './client';

export async function listUsers() {
  const res = await api.get('/users');
  return res.data;
}

export async function createUser(data) {
  const res = await api.post('/users', data);
  return res.data;
}

export async function updateUser(id, data) {
  const res = await api.put(`/users/${id}`, data);
  return res.data;
}

export async function deleteUser(id) {
  await api.delete(`/users/${id}`);
}
```

- [ ] **Step 4: Implement `front/src/pages/UsersPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import * as usersApi from '../api/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'developer' });

  useEffect(() => {
    usersApi.listUsers().then(setUsers);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const created = await usersApi.createUser(form);
    setUsers((prev) => [...prev, created]);
    setForm({ name: '', email: '', password: '', role: 'developer' });
  }

  async function handleDelete(id) {
    await usersApi.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Usuarios</h1>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="rounded border px-2 py-2 text-sm"
        >
          <option value="developer">Developer</option>
          <option value="admin">Admin</option>
        </select>
        <Button type="submit">Crear usuario</Button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)}>
                  Eliminar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 2 tests passed

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): add users management page"
```

---

## Task 21: Projects page (admin CRUD, developer read-only)

**Files:**
- Create: `front/src/api/projects.js`
- Create: `front/src/pages/ProjectsPage.jsx` (replaces stub)
- Test: `front/src/pages/ProjectsPage.test.jsx`

**Interfaces:**
- Consumes: `api` (Task 17), `useAuth` (Task 18).
- Produces: `front/src/api/projects.js` exports `{ listProjects(), createProject(data), updateProject(id, data), deleteProject(id) }`.

- [ ] **Step 1: Write the failing test**

`front/src/pages/ProjectsPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import ProjectsPage from './ProjectsPage';
import * as projectsApi from '../api/projects';

function renderAs(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, role }, loading: false }}>
      <ProjectsPage />
    </AuthContext.Provider>
  );
}

describe('ProjectsPage', () => {
  it('shows the create-project form for admins', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);
    renderAs('admin');
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalled());
    expect(screen.getByText('Crear proyecto')).toBeInTheDocument();
  });

  it('hides the create-project form for developers', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);
    renderAs('developer');
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalled());
    expect(screen.queryByText('Crear proyecto')).not.toBeInTheDocument();
  });

  it('lists projects returned by the API', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Website Revamp', status: 'active' },
    ]);
    renderAs('admin');
    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `front/src/api/projects.js`**

```js
import api from './client';

export async function listProjects() {
  const res = await api.get('/projects');
  return res.data;
}

export async function createProject(data) {
  const res = await api.post('/projects', data);
  return res.data;
}

export async function updateProject(id, data) {
  const res = await api.put(`/projects/${id}`, data);
  return res.data;
}

export async function deleteProject(id) {
  await api.delete(`/projects/${id}`);
}
```

- [ ] **Step 4: Implement `front/src/pages/ProjectsPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    projectsApi.listProjects().then(setProjects);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const created = await projectsApi.createProject({ name, description });
    setProjects((prev) => [...prev, created]);
    setName('');
    setDescription('');
  }

  async function handleArchive(project) {
    const updated = await projectsApi.updateProject(project.id, {
      status: project.status === 'active' ? 'archived' : 'active',
    });
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Proyectos</h1>

      {user.role === 'admin' && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit">Crear proyecto</Button>
        </form>
      )}

      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-600">{p.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-gray-500">{p.status}</span>
              {user.role === 'admin' && (
                <Button size="sm" variant="outline" onClick={() => handleArchive(p)}>
                  {p.status === 'active' ? 'Archivar' : 'Reactivar'}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 3 tests passed

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): add projects page with role-scoped actions"
```

---

## Task 22: Kanban board (drag-and-drop status transitions)

**Files:**
- Create: `front/src/api/tasks.js`
- Create: `front/src/components/kanban/TaskCard.jsx`
- Create: `front/src/components/kanban/KanbanColumn.jsx`
- Create: `front/src/pages/KanbanPage.jsx` (replaces stub)
- Test: `front/src/pages/KanbanPage.test.jsx`

**Interfaces:**
- Consumes: `api` (Task 17), `useAuth` (Task 18).
- Produces: `front/src/api/tasks.js` exports `{ listTasks(params), createTask(data), updateTaskStatus(id, status) }`. `KanbanPage` groups tasks fetched from `listTasks()` into 4 columns (`todo`, `in_progress`, `review`, `done`) and calls `updateTaskStatus` when a card is dropped on a different column, optimistically moving it in local state first.

- [ ] **Step 1: Write the failing test**

`front/src/pages/KanbanPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import KanbanPage from './KanbanPage';
import * as tasksApi from '../api/tasks';

function renderAs(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, role }, loading: false }}>
      <KanbanPage />
    </AuthContext.Provider>
  );
}

describe('KanbanPage', () => {
  it('groups fetched tasks into their status columns', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Build homepage', status: 'todo' },
      { id: 2, title: 'Fix nav bug', status: 'in_progress' },
      { id: 3, title: 'QA pass', status: 'done' },
    ]);

    renderAs('developer');

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();
    expect(screen.getByText('QA pass')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `front/src/api/tasks.js`**

```js
import api from './client';

export async function listTasks(params = {}) {
  const res = await api.get('/tasks', { params });
  return res.data;
}

export async function createTask(data) {
  const res = await api.post('/tasks', data);
  return res.data;
}

export async function updateTaskStatus(id, status) {
  const res = await api.patch(`/tasks/${id}/status`, { status });
  return res.data;
}
```

- [ ] **Step 4: Implement `front/src/components/kanban/TaskCard.jsx`**

```jsx
import { useDraggable } from '@dnd-kit/core';

export default function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded border bg-white p-2 text-sm shadow-sm"
    >
      {task.title}
    </div>
  );
}
```

- [ ] **Step 5: Implement `front/src/components/kanban/KanbanColumn.jsx`**

```jsx
import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';

const COLUMN_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export default function KanbanColumn({ status, tasks }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`w-64 flex-shrink-0 rounded p-2 ${isOver ? 'bg-blue-50' : 'bg-gray-100'}`}
    >
      <h2 className="mb-2 text-sm font-semibold">{COLUMN_LABELS[status]}</h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement `front/src/pages/KanbanPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import * as tasksApi from '../api/tasks';
import KanbanColumn from '../components/kanban/KanbanColumn';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

export default function KanbanPage() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    tasksApi.listTasks().then(setTasks);
  }, []);

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

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Kanban</h1>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 1 test passed

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): add drag-and-drop kanban board"
```

---

## Task 23: Task create modal (admin) on the Kanban page

**Files:**
- Create: `front/src/components/kanban/TaskFormModal.jsx`
- Modify: `front/src/pages/KanbanPage.jsx`
- Test: `front/src/components/kanban/TaskFormModal.test.jsx`

**Interfaces:**
- Consumes: `createTask` (Task 22), shadcn `Dialog` (installed in Task 17).
- Produces: `TaskFormModal` takes `{ projectId, users, onCreated }` and renders a shadcn `Dialog` with a form (title, description, assigneeId, dueDate) that calls `createTask` and then `onCreated(newTask)`.

- [ ] **Step 1: Write the failing test**

`front/src/components/kanban/TaskFormModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import TaskFormModal from './TaskFormModal';
import * as tasksApi from '../../api/tasks';

describe('TaskFormModal', () => {
  it('creates a task and calls onCreated with the result', async () => {
    vi.spyOn(tasksApi, 'createTask').mockResolvedValueOnce({ id: 10, title: 'New task', status: 'todo' });
    const onCreated = vi.fn();

    render(
      <TaskFormModal projectId={1} users={[]} onCreated={onCreated} />
    );

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    await act(async () => {
      screen.getByLabelText('Título').value = 'New task';
      screen.getByLabelText('Título').dispatchEvent(new Event('input', { bubbles: true }));
      screen.getByText('Guardar').click();
    });

    expect(tasksApi.createTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: 1, title: 'New task' }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `front/src/components/kanban/TaskFormModal.jsx`**

```jsx
import { useState } from 'react';
import * as tasksApi from '../../api/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function TaskFormModal({ projectId, users, onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const created = await tasksApi.createTask({
      projectId,
      title,
      description,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
    });
    onCreated(created);
    setOpen(false);
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setDueDate('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nueva tarea</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="assignee">Asignar a</Label>
            <select
              id="assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded border px-2 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="dueDate">Fecha límite</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 1 test passed

- [ ] **Step 5: Wire the modal into `front/src/pages/KanbanPage.jsx`**

Add the import and render it above the columns, scoped to a project selected via a simple dropdown fed by `listProjects()`. Update the top of the file:

```jsx
import { useEffect, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import * as usersApi from '../api/users';
import { useAuth } from '../context/AuthContext';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskFormModal from '../components/kanban/TaskFormModal';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    tasksApi.listTasks().then(setTasks);
    projectsApi.listProjects().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(data[0].id);
    });
    if (user.role === 'admin') {
      usersApi.listUsers().then(setUsers);
    }
  }, [user.role]);

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

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kanban</h1>
        {user.role === 'admin' && selectedProjectId && (
          <TaskFormModal projectId={selectedProjectId} users={users} onCreated={handleTaskCreated} />
        )}
      </div>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): add task creation modal to kanban page"
```

---

## Task 24: Notes & Reminders page

**Files:**
- Create: `front/src/api/notes.js`
- Create: `front/src/components/notes/NoteFormModal.jsx`
- Create: `front/src/components/notes/NotesList.jsx`
- Create: `front/src/pages/NotesPage.jsx` (replaces stub)
- Test: `front/src/pages/NotesPage.test.jsx`

**Interfaces:**
- Consumes: `api` (Task 17), shadcn `Dialog`/`Input`/`Textarea` (Task 17).
- Produces: `front/src/api/notes.js` exports `{ listNotes(params), createNote(data), updateNote(id, data), deleteNote(id) }`. `NotesList` takes `{ notes, onDelete }` and renders each note with title/content, a "Recordatorio: <date>" badge when `isReminder`, and a delete button. `NoteFormModal` takes `{ projectId, taskId, onCreated }` (both optional/undefined for a standalone note) and renders a form with a reminder toggle that reveals a datetime input only when checked.

- [ ] **Step 1: Write the failing test**

`front/src/pages/NotesPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NotesPage from './NotesPage';
import * as notesApi from '../api/notes';

describe('NotesPage', () => {
  it('lists notes and shows a reminder badge for reminder notes', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Loose note', content: 'x', isReminder: false },
      { id: 2, title: 'Ping client', content: 'y', isReminder: true, remindAt: '2026-09-20T10:00:00.000Z' },
    ]);

    render(<NotesPage />);

    await waitFor(() => expect(screen.getByText('Loose note')).toBeInTheDocument());
    expect(screen.getByText('Ping client')).toBeInTheDocument();
    expect(screen.getByText(/Recordatorio:/)).toBeInTheDocument();
  });

  it('deletes a note when its delete button is clicked', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Loose note', content: 'x', isReminder: false },
    ]);
    vi.spyOn(notesApi, 'deleteNote').mockResolvedValueOnce(undefined);

    render(<NotesPage />);
    await waitFor(() => expect(screen.getByText('Loose note')).toBeInTheDocument());

    screen.getByText('Eliminar').click();

    await waitFor(() => expect(notesApi.deleteNote).toHaveBeenCalledWith(1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `front/src/api/notes.js`**

```js
import api from './client';

export async function listNotes(params = {}) {
  const res = await api.get('/notes', { params });
  return res.data;
}

export async function createNote(data) {
  const res = await api.post('/notes', data);
  return res.data;
}

export async function updateNote(id, data) {
  const res = await api.put(`/notes/${id}`, data);
  return res.data;
}

export async function deleteNote(id) {
  await api.delete(`/notes/${id}`);
}
```

- [ ] **Step 4: Implement `front/src/components/notes/NotesList.jsx`**

```jsx
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function NotesList({ notes, onDelete }) {
  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="flex items-start justify-between rounded border p-3">
          <div>
            <p className="font-medium">{note.title}</p>
            <p className="text-sm text-gray-600">{note.content}</p>
            {note.isReminder && (
              <Badge variant="secondary" className="mt-1">
                Recordatorio: {new Date(note.remindAt).toLocaleString()}
              </Badge>
            )}
          </div>
          <Button variant="destructive" size="sm" onClick={() => onDelete(note.id)}>
            Eliminar
          </Button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Implement `front/src/components/notes/NoteFormModal.jsx`**

```jsx
import { useState } from 'react';
import * as notesApi from '../../api/notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function NoteFormModal({ projectId, taskId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isReminder, setIsReminder] = useState(false);
  const [remindAt, setRemindAt] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const created = await notesApi.createNote({
      title,
      content,
      projectId,
      taskId,
      isReminder,
      remindAt: isReminder ? remindAt : undefined,
    });
    onCreated(created);
    setOpen(false);
    setTitle('');
    setContent('');
    setIsReminder(false);
    setRemindAt('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nueva nota</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva nota</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="note-title">Título</Label>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="note-content">Contenido</Label>
            <Textarea id="note-content" value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="note-is-reminder"
              type="checkbox"
              checked={isReminder}
              onChange={(e) => setIsReminder(e.target.checked)}
            />
            <Label htmlFor="note-is-reminder">Convertir en recordatorio</Label>
          </div>
          {isReminder && (
            <div>
              <Label htmlFor="note-remind-at">Fecha y hora</Label>
              <Input
                id="note-remind-at"
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                required
              />
            </div>
          )}
          <Button type="submit">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Implement `front/src/pages/NotesPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    notesApi.listNotes().then(setNotes);
  }, []);

  function handleCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleDelete(id) {
    await notesApi.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notas y Recordatorios</h1>
        <NoteFormModal onCreated={handleCreated} />
      </div>
      <NotesList notes={notes} onDelete={handleDelete} />
    </div>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 2 tests passed

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): add notes and reminders page"
```

---

## Task 25: Embed linked notes in Project and Task detail views

**Files:**
- Create: `front/src/pages/ProjectDetailPage.jsx`
- Create: `front/src/pages/TaskDetailPage.jsx`
- Modify: `front/src/App.jsx`
- Modify: `front/src/pages/ProjectsPage.jsx`
- Modify: `front/src/components/kanban/TaskCard.jsx`
- Test: `front/src/pages/ProjectDetailPage.test.jsx`

**Interfaces:**
- Consumes: `listNotes`, `NoteFormModal`, `NotesList` (Task 24).
- Produces: `/projects/:id` renders `ProjectDetailPage`, which shows the project and a notes sub-section scoped via `listNotes({ projectId })` with a `NoteFormModal` pre-set to that `projectId`. `/tasks/:id` renders `TaskDetailPage` analogously scoped via `taskId`. `ProjectsPage` project names link to `/projects/:id`; `TaskCard` titles link to `/tasks/:id`.

- [ ] **Step 1: Write the failing test**

`front/src/pages/ProjectDetailPage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';

describe('ProjectDetailPage', () => {
  it('fetches the project and shows only notes linked to it', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'active' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Kickoff notes', content: 'y', isReminder: false, projectId: 7 },
    ]);

    render(
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
    expect(notesApi.listNotes).toHaveBeenCalledWith({ projectId: '7' });
    expect(screen.getByText('Kickoff notes')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd front && npm test`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `front/src/pages/ProjectDetailPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    projectsApi.listProjects().then((projects) => {
      setProject(projects.find((p) => String(p.id) === id) || null);
    });
    notesApi.listNotes({ projectId: id }).then(setNotes);
  }, [id]);

  function handleNoteCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleNoteDelete(noteId) {
    await notesApi.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (!project) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-gray-600">{project.description}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Notas del proyecto</h2>
          <NoteFormModal projectId={project.id} onCreated={handleNoteCreated} />
        </div>
        <NotesList notes={notes} onDelete={handleNoteDelete} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `front/src/pages/TaskDetailPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';

export default function TaskDetailPage() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    tasksApi.listTasks().then((tasks) => {
      setTask(tasks.find((t) => String(t.id) === id) || null);
    });
    notesApi.listNotes({ taskId: id }).then(setNotes);
  }, [id]);

  function handleNoteCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleNoteDelete(noteId) {
    await notesApi.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (!task) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{task.title}</h1>
        <p className="text-sm text-gray-600">{task.description}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Notas de la tarea</h2>
          <NoteFormModal taskId={task.id} onCreated={handleNoteCreated} />
        </div>
        <NotesList notes={notes} onDelete={handleNoteDelete} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the two detail routes to `front/src/App.jsx`**

Add these imports:

```jsx
import ProjectDetailPage from './pages/ProjectDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
```

Add these routes inside `<Routes>`, alongside the existing ones:

```jsx
<Route path="/projects/:id" element={<AuthenticatedLayout><ProjectDetailPage /></AuthenticatedLayout>} />
<Route path="/tasks/:id" element={<AuthenticatedLayout><TaskDetailPage /></AuthenticatedLayout>} />
```

- [ ] **Step 6: Link project names in `front/src/pages/ProjectsPage.jsx`**

Replace `<p className="font-medium">{p.name}</p>` with:

```jsx
<Link to={`/projects/${p.id}`} className="font-medium hover:underline">
  {p.name}
</Link>
```

Add the import at the top of the file:

```jsx
import { Link } from 'react-router-dom';
```

- [ ] **Step 7: Link task titles in `front/src/components/kanban/TaskCard.jsx`**

Replace the card content so the title links to the detail page while keeping the whole card draggable:

```jsx
import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';

export default function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded border bg-white p-2 text-sm shadow-sm"
    >
      <Link to={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
        {task.title}
      </Link>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd front && npm test`
Expected: PASS — 1 test passed, and the full suite still green

- [ ] **Step 9: Run the full frontend test suite**

Run: `cd front && npm test`
Expected: PASS — all frontend tests passing (api client, auth context, app shell, users page, projects page, kanban page, task modal, notes page, project detail page)

- [ ] **Step 10: Commit**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk"
git add -A
git commit -m "feat(front): embed linked notes into project and task detail views"
```

---

**The app is now feature-complete per the spec.** Final manual smoke test:

```bash
# terminal 1
cd back && npm run dev

# terminal 2
cd front && npm run dev
```

Open the frontend URL, log in with the seeded admin, create a project, create a task, assign it to a developer, log in as that developer in a second browser/profile, drag the task across Kanban columns, create a standalone note and a reminder note (set `remindAt` a minute in the future) and confirm the email arrives once the cron job ticks.
