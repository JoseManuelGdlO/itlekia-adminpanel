# Project finance and features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins record cost/contract/budget line items (optional file) on a project and manage features with one-shot email reminders; member developers never see finance and only read features.

**Architecture:** Two models (`FinanceItem`, `Feature`) mounted under `/projects/:id`. Finance is admin-only including file download. Features GET is admin or project member; writes are admin-only. Files live on disk under `back/uploads/finance/` (gitignored). The existing reminder cron also sends due feature emails to the creating admin via the current mailer shape `{ to, note: { title, content } }`.

**Tech Stack:** Express, Sequelize, multer (new backend dependency), React 19, Vitest. No S3. No new frontend packages.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-14-project-finance-features-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. Kanban, members, and notes stay unchanged except ProjectDetailPage mounts two new cards.
- Error bodies `{ error: string }` with exact strings: `Project not found`, `Forbidden`, `Finance item not found`, `Feature not found`, `File not found`, `Invalid kind`, `Invalid amount`, `Invalid file type`, `File too large`.
- Finance JSON omits `storedName` and includes `hasFile`.
- Allowed MIME: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. Max 10 MB.
- Exact UI copy: `Finanzas`, `Costos`, `Contratos`, `Presupuesto`, `Sin partidas`, `Agregar`, `Quitar`, `Descargar`, `Total `, `Features`, `Sin features`, `Nuevo feature`, `Pendiente`, `Hecho`.
- Keep existing strings: `Miembros`, `No se encontró`, `Notas del proyecto`.
- TDD: failing test first. Commit after each task. Do not push.
- Do not email members for feature reminders. Do not let developers edit features.

## File map

| File | Role |
|---|---|
| `back/src/models/financeItem.js` | Cost/contract/budget row |
| `back/src/models/feature.js` | Project feature + reminder fields |
| `back/src/models/index.js` | Associations + exports |
| `back/src/utils/financeFiles.js` | Disk path, save, delete |
| `back/src/controllers/financeController.js` | Finance CRUD + file stream |
| `back/src/controllers/featuresController.js` | Feature CRUD |
| `back/src/middleware/financeUpload.js` | multer 10 MB + MIME filter |
| `back/src/routes/projects.js` | Mount finance + feature routes |
| `back/src/jobs/reminderJob.js` | Also send due feature emails |
| `back/.gitignore` | `uploads/` |
| `front/src/api/finance.js` | Client for finance + FormData + blob download |
| `front/src/api/features.js` | Client for features |
| `front/src/components/projects/ProjectFinanceCard.jsx` | Admin-only finance UI |
| `front/src/components/projects/ProjectFeaturesCard.jsx` | Features list + admin form |
| `front/src/pages/ProjectDetailPage.jsx` | Mount both cards |

---

### Task 1: FinanceItem model

**Files:**
- Create: `back/src/models/financeItem.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/financeItem.test.js`

**Interfaces:**
- Consumes: existing `Project`, `User`, `sequelize`.
- Produces: `FinanceItem` with `projectId`, `kind` ENUM `cost|contract|budget`, `title` STRING required, `amount` DECIMAL(12,2) required, `notes` TEXT nullable, `fileName` STRING nullable, `storedName` STRING nullable, `mimeType` STRING nullable, `createdBy` INTEGER required. Associations: `Project.hasMany(FinanceItem, { foreignKey: 'projectId', as: 'financeItems' })`, `FinanceItem.belongsTo(Project, { foreignKey: 'projectId', as: 'project' })`, `User.hasMany(FinanceItem, { foreignKey: 'createdBy', as: 'financeItems' })`, `FinanceItem.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })`. Export `FinanceItem`.

- [ ] **Step 1: Write the failing test**

Create `back/tests/models/financeItem.test.js`:

```javascript
const { sequelize, User, Project, FinanceItem } = require('../../src/models');

describe('FinanceItem model', () => {
  let project;
  let admin;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'Website Revamp' });
    admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a cost line linked to a project', async () => {
    const item = await FinanceItem.create({
      projectId: project.id,
      kind: 'cost',
      title: 'Hosting',
      amount: 49.99,
      notes: 'Yearly',
      createdBy: admin.id,
    });
    expect(item.kind).toBe('cost');
    expect(Number(item.amount)).toBe(49.99);
    expect(item.storedName).toBeNull();
    const withProject = await FinanceItem.findByPk(item.id, { include: ['project', 'creator'] });
    expect(withProject.project.name).toBe('Website Revamp');
    expect(withProject.creator.email).toBe('admin@example.com');
  });

  it('rejects an invalid kind', async () => {
    await expect(
      FinanceItem.create({
        projectId: project.id,
        kind: 'invoice',
        title: 'Bad',
        amount: 1,
        createdBy: admin.id,
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/financeItem.test.js
```

Expected: FAIL (cannot find `FinanceItem`).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/models/financeItem.js`:

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FinanceItem = sequelize.define(
    'FinanceItem',
    {
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      kind: {
        type: DataTypes.ENUM('cost', 'contract', 'budget'),
        allowNull: false,
        validate: {
          isIn: { args: [['cost', 'contract', 'budget']], msg: 'Invalid kind' },
        },
      },
      title: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      fileName: { type: DataTypes.STRING, allowNull: true },
      storedName: { type: DataTypes.STRING, allowNull: true },
      mimeType: { type: DataTypes.STRING, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: false },
    }
  );
  return FinanceItem;
};
```

In `back/src/models/index.js`, after TaskActivity:

```javascript
const FinanceItem = require('./financeItem')(sequelize);
```

Associations:

```javascript
Project.hasMany(FinanceItem, { foreignKey: 'projectId', as: 'financeItems' });
FinanceItem.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
User.hasMany(FinanceItem, { foreignKey: 'createdBy', as: 'financeItems' });
FinanceItem.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
```

Export `FinanceItem`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/financeItem.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/models/financeItem.js back/src/models/index.js back/tests/models/financeItem.test.js
git commit -m "$(cat <<'EOF'
feat: add FinanceItem model

EOF
)"
```

---

### Task 2: Finance HTTP API (CRUD + files)

**Files:**
- Create: `back/src/utils/financeFiles.js`
- Create: `back/src/middleware/financeUpload.js`
- Create: `back/src/controllers/financeController.js`
- Modify: `back/src/routes/projects.js`
- Modify: `back/.gitignore`
- Modify: `back/package.json` (add `multer`)
- Test: `back/tests/routes/finance.test.js`

**Interfaces:**
- Consumes: `FinanceItem`, `Project`; `requireAuth`, `requireRole('admin')`.
- Produces:
  - `toPublicFinanceItem(item)` → `{ id, projectId, kind, title, amount: Number, notes, fileName, mimeType, hasFile, createdBy, createdAt, updatedAt }` (no `storedName`).
  - `GET/POST /projects/:id/finance`, `PUT/DELETE /projects/:id/finance/:itemId`, `GET /projects/:id/finance/:itemId/file`.
  - Upload dir `process.env.FINANCE_UPLOAD_DIR` or `back/uploads/finance`. Tests must set `FINANCE_UPLOAD_DIR` to a temp folder.
  - `saveFinanceFile(itemId, file)` writes buffer, returns `{ storedName, fileName, mimeType }`. `removeFinanceFile(storedName)` unlinks if present.
  - multer memoryStorage, file field `file`, 10 MB, MIME whitelist; `Invalid file type` / `File too large` mapped to 400 **before** the generic 500 handler (attach a multer error mapper on these routes).

- [ ] **Step 1: Install multer and write the failing test**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm install multer
```

Append to `back/.gitignore`:

```
uploads/
```

Create `back/tests/routes/finance.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret';
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.FINANCE_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-'));

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('finance routes', () => {
  let adminCookie;
  let developerCookie;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const developer = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    developerCookie = `token=${signToken({ id: developer.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
  });

  afterAll(async () => {
    await sequelize.close();
    fs.rmSync(process.env.FINANCE_UPLOAD_DIR, { recursive: true, force: true });
  });

  it('admin creates lists and deletes a finance item; JSON has hasFile and no storedName', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'Hosting')
      .field('amount', '49.99')
      .field('notes', 'Yearly');
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        kind: 'cost',
        title: 'Hosting',
        amount: 49.99,
        notes: 'Yearly',
        hasFile: false,
      })
    );
    expect(created.body.storedName).toBeUndefined();

    const listed = await request(app).get(`/projects/${project.id}/finance`).set('Cookie', adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const del = await request(app)
      .delete(`/projects/${project.id}/finance/${created.body.id}`)
      .set('Cookie', adminCookie);
    expect(del.status).toBe(204);
  });

  it('developer cannot list or create finance items', async () => {
    const get = await request(app).get(`/projects/${project.id}/finance`).set('Cookie', developerCookie);
    expect(get.status).toBe(403);
    expect(get.body).toEqual({ error: 'Forbidden' });
    const post = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', developerCookie)
      .field('kind', 'cost')
      .field('title', 'Nope')
      .field('amount', '1');
    expect(post.status).toBe(403);
  });

  it('rejects invalid amount and kind', async () => {
    const amount = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'cost')
      .field('title', 'X')
      .field('amount', '-1');
    expect(amount.status).toBe(400);
    expect(amount.body).toEqual({ error: 'Invalid amount' });

    const kind = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'invoice')
      .field('title', 'X')
      .field('amount', '1');
    expect(kind.status).toBe(400);
    expect(kind.body).toEqual({ error: 'Invalid kind' });
  });

  it('uploads a pdf, downloads it, and 404s when there is no file', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'contract')
      .field('title', 'SOW')
      .field('amount', '1000')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'sow.pdf', contentType: 'application/pdf' });
    expect(created.status).toBe(201);
    expect(created.body.hasFile).toBe(true);
    expect(created.body.fileName).toBe('sow.pdf');

    const file = await request(app)
      .get(`/projects/${project.id}/finance/${created.body.id}/file`)
      .set('Cookie', adminCookie);
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toMatch(/sow\.pdf/);

    const empty = await request(app)
      .post(`/projects/${project.id}/finance`)
      .set('Cookie', adminCookie)
      .field('kind', 'budget')
      .field('title', 'Cap')
      .field('amount', '5000');
    const missing = await request(app)
      .get(`/projects/${project.id}/finance/${empty.body.id}/file`)
      .set('Cookie', adminCookie);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'File not found' });

    const forbidden = await request(app)
      .get(`/projects/${project.id}/finance/${created.body.id}/file`)
      .set('Cookie', developerCookie);
    expect(forbidden.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/finance.test.js
```

Expected: FAIL (no `/finance` routes).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/utils/financeFiles.js`:

```javascript
const fs = require('fs');
const path = require('path');

function uploadDir() {
  return process.env.FINANCE_UPLOAD_DIR || path.join(__dirname, '../../uploads/finance');
}

function ensureDir() {
  fs.mkdirSync(uploadDir(), { recursive: true });
}

function safeOriginal(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function saveFinanceFile(itemId, file) {
  ensureDir();
  const storedName = `${itemId}-${safeOriginal(file.originalname)}`;
  fs.writeFileSync(path.join(uploadDir(), storedName), file.buffer);
  return { storedName, fileName: file.originalname, mimeType: file.mimetype };
}

function removeFinanceFile(storedName) {
  if (!storedName) return;
  const full = path.join(uploadDir(), storedName);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function financeFilePath(storedName) {
  return path.join(uploadDir(), storedName);
}

module.exports = { saveFinanceFile, removeFinanceFile, financeFilePath };
```

Create `back/src/middleware/financeUpload.js`:

```javascript
const multer = require('multer');

const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  },
});

function mapFinanceUploadError(err, req, res, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  if (err.message === 'Invalid file type') {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  return next(err);
}

function financeUpload(req, res, next) {
  upload.single('file')(req, res, (err) => mapFinanceUploadError(err, req, res, next));
}

module.exports = { financeUpload };
```

Create `back/src/controllers/financeController.js`:

```javascript
const { Project, FinanceItem } = require('../models');
const { saveFinanceFile, removeFinanceFile, financeFilePath } = require('../utils/financeFiles');

const KINDS = ['cost', 'contract', 'budget'];

function toPublicFinanceItem(item) {
  return {
    id: item.id,
    projectId: item.projectId,
    kind: item.kind,
    title: item.title,
    amount: Number(item.amount),
    notes: item.notes,
    fileName: item.fileName,
    mimeType: item.mimeType,
    hasFile: Boolean(item.storedName),
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

async function loadProject(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

async function loadItem(req, res, project) {
  const item = await FinanceItem.findOne({
    where: { id: req.params.itemId, projectId: project.id },
  });
  if (!item) {
    res.status(404).json({ error: 'Finance item not found' });
    return null;
  }
  return item;
}

async function list(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const items = await FinanceItem.findAll({
    where: { projectId: project.id },
    order: [['id', 'ASC']],
  });
  return res.json(items.map(toPublicFinanceItem));
}

async function create(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const { kind, title, notes } = req.body;
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: 'Invalid kind' });
  }
  const amount = parseAmount(req.body.amount);
  if (amount === null) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const item = await FinanceItem.create({
    projectId: project.id,
    kind,
    title,
    amount,
    notes: notes || null,
    createdBy: req.user.id,
  });
  if (req.file) {
    const saved = saveFinanceFile(item.id, req.file);
    item.fileName = saved.fileName;
    item.storedName = saved.storedName;
    item.mimeType = saved.mimeType;
    await item.save();
  }
  return res.status(201).json(toPublicFinanceItem(item));
}

async function update(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const item = await loadItem(req, res, project);
  if (!item) return;
  if (req.body.kind !== undefined) {
    if (!KINDS.includes(req.body.kind)) {
      return res.status(400).json({ error: 'Invalid kind' });
    }
    item.kind = req.body.kind;
  }
  if (req.body.title !== undefined) item.title = req.body.title;
  if (req.body.notes !== undefined) item.notes = req.body.notes;
  if (req.body.amount !== undefined) {
    const amount = parseAmount(req.body.amount);
    if (amount === null) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    item.amount = amount;
  }
  if (req.file) {
    removeFinanceFile(item.storedName);
    const saved = saveFinanceFile(item.id, req.file);
    item.fileName = saved.fileName;
    item.storedName = saved.storedName;
    item.mimeType = saved.mimeType;
  }
  await item.save();
  return res.json(toPublicFinanceItem(item));
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const item = await loadItem(req, res, project);
  if (!item) return;
  removeFinanceFile(item.storedName);
  await item.destroy();
  return res.status(204).send();
}

async function download(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const item = await loadItem(req, res, project);
  if (!item) return;
  if (!item.storedName) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.download(financeFilePath(item.storedName), item.fileName);
}

module.exports = { list, create, update, remove, download };
```

In `back/src/routes/projects.js` require the controller and `{ financeUpload }`, then **before** `router.put('/:id'`):

```javascript
router.get('/:id/finance', requireRole('admin'), finance.list);
router.post('/:id/finance', requireRole('admin'), financeUpload, finance.create);
router.put('/:id/finance/:itemId', requireRole('admin'), financeUpload, finance.update);
router.delete('/:id/finance/:itemId', requireRole('admin'), finance.remove);
router.get('/:id/finance/:itemId/file', requireRole('admin'), finance.download);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/finance.test.js
npm test
```

Expected: PASS (full backend suite).

- [ ] **Step 5: Commit**

```bash
git add back/package.json back/package-lock.json back/.gitignore back/src/utils/financeFiles.js back/src/middleware/financeUpload.js back/src/controllers/financeController.js back/src/routes/projects.js back/tests/routes/finance.test.js
git commit -m "$(cat <<'EOF'
feat: add admin finance items API with optional file upload

EOF
)"
```

---

### Task 3: Finanzas card on project detail

**Files:**
- Create: `front/src/api/finance.js`
- Create: `front/src/components/projects/ProjectFinanceCard.jsx`
- Test: `front/src/components/projects/ProjectFinanceCard.test.jsx`
- Modify: `front/src/pages/ProjectDetailPage.jsx`
- Modify: `front/src/pages/ProjectDetailPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()`, finance API.
- Produces:
  - `listFinance(projectId)`, `createFinance(projectId, formData)`, `deleteFinance(projectId, itemId)`, `downloadFinanceFile(projectId, itemId, fileName)` (`responseType: 'blob'` then object URL click; tests mock this).
  - Card title `Finanzas`. Sections `Costos` / `Contratos` / `Presupuesto` (`kind` `cost` / `contract` / `budget`). Button `Agregar`. Empty `Sin partidas`. Download `Descargar`. Remove `Quitar`. Under Presupuesto: `Total {sum}` where sum is budget amounts only (format with the numeric value, e.g. `Total 5000` if a single 5000 item — use `String(sum)` so `Total 49.99` works).
  - Render the card in `ProjectDetailPage` **only when** `user.role === 'admin'` (page uses `useAuth`). Developer tests must not see `Finanzas`.

- [ ] **Step 1: Write the failing tests**

Create `front/src/components/projects/ProjectFinanceCard.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProjectFinanceCard from './ProjectFinanceCard';
import * as financeApi from '../../api/finance';

describe('ProjectFinanceCard', () => {
  it('groups items and creates a cost', async () => {
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([
      { id: 1, kind: 'budget', title: 'Cap', amount: 5000, notes: '', hasFile: false },
    ]);
    vi.spyOn(financeApi, 'createFinance').mockResolvedValue({
      id: 2,
      kind: 'cost',
      title: 'Hosting',
      amount: 49.99,
      notes: 'Yearly',
      hasFile: false,
    });

    render(<ProjectFinanceCard projectId={7} />);

    await waitFor(() => expect(screen.getByText('Cap')).toBeInTheDocument());
    expect(screen.getByText('Finanzas')).toBeInTheDocument();
    expect(screen.getByText('Costos')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
    expect(screen.getByText('Presupuesto')).toBeInTheDocument();
    expect(screen.getByText('Total 5000')).toBeInTheDocument();

    const [costTitle] = screen.getAllByLabelText('Título');
    fireEvent.change(costTitle, { target: { value: 'Hosting' } });
    fireEvent.change(screen.getAllByLabelText('Monto')[0], { target: { value: '49.99' } });
    fireEvent.change(screen.getAllByLabelText('Nota')[0], { target: { value: 'Yearly' } });
    fireEvent.click(screen.getAllByText('Agregar')[0]);

    await waitFor(() => expect(financeApi.createFinance).toHaveBeenCalled());
    const fd = financeApi.createFinance.mock.calls[0][1];
    expect(fd.get('kind')).toBe('cost');
    expect(fd.get('title')).toBe('Hosting');
    expect(await screen.findByText('Hosting')).toBeInTheDocument();
  });
});
```

In `ProjectDetailPage.test.jsx`, mock `financeApi.listFinance` to `[]` in existing tests (admin page will mount the card). Add:

```javascript
import * as financeApi from '../api/finance';
import * as featuresApi from '../api/features';
```

Until Task 7, **do not import featuresApi** if the page does not mount features yet. Only mock finance in this task:

```javascript
vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
```

Add a developer render test (or extend this file):

```javascript
it('hides Finanzas for a developer', async () => {
  vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
    { id: 7, name: 'Website Revamp', description: 'x', status: 'active' },
  ]);
  vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
  vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);

  render(
    <AuthContext.Provider value={{ user: { id: 2, name: 'Dev', role: 'developer' }, loading: false }}>
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

  await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
  expect(screen.queryByText('Finanzas')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/projects/ProjectFinanceCard.test.jsx src/pages/ProjectDetailPage.test.jsx
```

Expected: FAIL (missing component / `Finanzas`).

- [ ] **Step 3: Write minimal implementation**

Create `front/src/api/finance.js`:

```javascript
import api from './client';

export async function listFinance(projectId) {
  const res = await api.get(`/projects/${projectId}/finance`);
  return res.data;
}

export async function createFinance(projectId, formData) {
  const res = await api.post(`/projects/${projectId}/finance`, formData);
  return res.data;
}

export async function deleteFinance(projectId, itemId) {
  await api.delete(`/projects/${projectId}/finance/${itemId}`);
}

export async function downloadFinanceFile(projectId, itemId, fileName) {
  const res = await api.get(`/projects/${projectId}/finance/${itemId}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'file';
  a.click();
  URL.revokeObjectURL(url);
}
```

Create `front/src/components/projects/ProjectFinanceCard.jsx` with `SECTIONS = [{ kind: 'cost', heading: 'Costos' }, { kind: 'contract', heading: 'Contratos' }, { kind: 'budget', heading: 'Presupuesto' }]`. Each section has its own title/amount/notes/file inputs with labels `Título`, `Monto`, `Nota`, `Archivo` (give inputs unique ids per kind, e.g. `finance-title-cost`). `Agregar` builds `FormData` with `kind`, `title`, `amount`, `notes`, and `file` if chosen. List items show title, amount, notes, `Descargar` if `hasFile`, `Quitar`. Budget section footer: `Total {budgetItems.reduce((s, i) => s + Number(i.amount), 0)}`. Empty list in a section: `Sin partidas`.

Mount in `ProjectDetailPage.jsx`:

```javascript
import { useAuth } from '../context/AuthContext';
import ProjectFinanceCard from '../components/projects/ProjectFinanceCard';

const { user } = useAuth();
// after ProjectMembersCard:
{user.role === 'admin' && <ProjectFinanceCard projectId={project.id} />}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/projects/ProjectFinanceCard.test.jsx src/pages/ProjectDetailPage.test.jsx
npx vitest run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/finance.js front/src/components/projects/ProjectFinanceCard.jsx front/src/components/projects/ProjectFinanceCard.test.jsx front/src/pages/ProjectDetailPage.jsx front/src/pages/ProjectDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: add admin Finanzas card on project detail

EOF
)"
```

---

### Task 4: Feature model

**Files:**
- Create: `back/src/models/feature.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/feature.test.js`

**Interfaces:**
- Consumes: `Project`, `User`.
- Produces: `Feature` with `projectId`, `userId` (creator), `title` required, `description` TEXT nullable, `status` ENUM `pending|done` default `pending`, `isReminder` BOOLEAN default false, `remindAt` DATE nullable, `notifiedAt` DATE nullable. Associations: `Project.hasMany(Feature, { foreignKey: 'projectId', as: 'features' })`, `Feature.belongsTo(Project, { as: 'project' })`, `User.hasMany(Feature, { foreignKey: 'userId', as: 'features' })`, `Feature.belongsTo(User, { foreignKey: 'userId', as: 'creator' })`. Export `Feature`.

- [ ] **Step 1: Write the failing test**

Create `back/tests/models/feature.test.js`:

```javascript
const { sequelize, User, Project, Feature } = require('../../src/models');

describe('Feature model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('defaults status to pending', async () => {
    const project = await Project.create({ name: 'A' });
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
    const feature = await Feature.create({
      projectId: project.id,
      userId: admin.id,
      title: 'SSO',
    });
    expect(feature.status).toBe('pending');
    expect(feature.isReminder).toBe(false);
    const loaded = await Feature.findByPk(feature.id, { include: ['creator'] });
    expect(loaded.creator.email).toBe('admin@example.com');
  });

  it('rejects an invalid status', async () => {
    const project = await Project.create({ name: 'B' });
    const admin = await User.create({
      name: 'A2',
      email: 'a2@example.com',
      passwordHash: 'x',
      role: 'admin',
    });
    await expect(
      Feature.create({
        projectId: project.id,
        userId: admin.id,
        title: 'Bad',
        status: 'shipped',
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/feature.test.js
```

Expected: FAIL (no `Feature`).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/models/feature.js`:

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Feature = sequelize.define('Feature', {
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'done'),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: { args: [['pending', 'done']], msg: 'Invalid status' },
      },
    },
    isReminder: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    remindAt: { type: DataTypes.DATE, allowNull: true },
    notifiedAt: { type: DataTypes.DATE, allowNull: true },
  });
  return Feature;
};
```

Register in `index.js` (keep FinanceItem associations). Associations `as: 'features'` / `as: 'creator'`. Export `Feature`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/models/feature.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/models/feature.js back/src/models/index.js back/tests/models/feature.test.js
git commit -m "$(cat <<'EOF'
feat: add Feature model

EOF
)"
```

---

### Task 5: Features HTTP API

**Files:**
- Create: `back/src/controllers/featuresController.js`
- Modify: `back/src/routes/projects.js`
- Test: `back/tests/routes/features.test.js`

**Interfaces:**
- Consumes: `Feature`, `Project`, `ProjectMember`; `isProjectMember(userId, projectId)`.
- Produces:
  - `GET /projects/:id/features` — admin or member; 403 `Forbidden` otherwise; `id ASC`.
  - `POST /projects/:id/features` — `requireRole('admin')`. Body `{ title, description, status, isReminder, remindAt }`. `userId = req.user.id`. Invalid status → 400 (use `{ error: 'Invalid status' }` — already in the global error-string list via tasks; acceptable). If the spec list omitted it, still return 400 `{ error: 'Invalid status' }`.
  - `PUT /projects/:id/features/:featureId` — admin. Optional fields. If `isReminder` is `false`, set `remindAt = null` and **do not** clear `notifiedAt`.
  - `DELETE` — admin, 204. 404 `{ error: 'Feature not found' }` if missing or wrong project.
  - Developer POST → 403.

- [ ] **Step 1: Write the failing test**

Create `back/tests/routes/features.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Project, ProjectMember } = require('../../src/models');
const { signToken } = require('../../src/utils/jwt');

describe('features routes', () => {
  let adminCookie;
  let memberCookie;
  let outsiderCookie;
  let project;
  let admin;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    const member = await User.create({ name: 'Dev', email: 'dev@example.com', passwordHash: 'x', role: 'developer' });
    const outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    adminCookie = `token=${signToken({ id: admin.id, role: 'admin' })}`;
    memberCookie = `token=${signToken({ id: member.id, role: 'developer' })}`;
    outsiderCookie = `token=${signToken({ id: outsider.id, role: 'developer' })}`;
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: member.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('admin creates and member can list; outsider and developer write are forbidden', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({ title: 'SSO', description: 'Login', status: 'pending' });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('SSO');
    expect(created.body.userId).toBe(admin.id);

    const listed = await request(app).get(`/projects/${project.id}/features`).set('Cookie', memberCookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const denied = await request(app).get(`/projects/${project.id}/features`).set('Cookie', outsiderCookie);
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: 'Forbidden' });

    const write = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', memberCookie)
      .send({ title: 'Nope' });
    expect(write.status).toBe(403);
  });

  it('clearing isReminder nulls remindAt but keeps notifiedAt', async () => {
    const created = await request(app)
      .post(`/projects/${project.id}/features`)
      .set('Cookie', adminCookie)
      .send({
        title: 'Alerts',
        isReminder: true,
        remindAt: new Date().toISOString(),
      });
    const { Feature } = require('../../src/models');
    const row = await Feature.findByPk(created.body.id);
    row.notifiedAt = new Date();
    await row.save();

    const updated = await request(app)
      .put(`/projects/${project.id}/features/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ isReminder: false });
    expect(updated.status).toBe(200);
    expect(updated.body.isReminder).toBe(false);
    expect(updated.body.remindAt).toBeNull();
    expect(updated.body.notifiedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/features.test.js
```

Expected: FAIL (no `/features` routes).

- [ ] **Step 3: Write minimal implementation**

Create `back/src/controllers/featuresController.js` mirroring `membersController` `loadProject`. GET: if not admin, `isProjectMember` or 403. POST: `Feature.create({ projectId, userId: req.user.id, title, description, status: status || 'pending', isReminder: Boolean(isReminder), remindAt: isReminder ? remindAt : null })`. PUT: if `status` sent and not in `['pending','done']` → 400 `{ error: 'Invalid status' }`. If `isReminder === false`, `feature.remindAt = null`. DELETE destroy.

Mount in `projects.js` (admin writes, GET without requireRole admin):

```javascript
router.get('/:id/features', features.list);
router.post('/:id/features', requireRole('admin'), features.create);
router.put('/:id/features/:featureId', requireRole('admin'), features.update);
router.delete('/:id/features/:featureId', requireRole('admin'), features.remove);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/routes/features.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/featuresController.js back/src/routes/projects.js back/tests/routes/features.test.js
git commit -m "$(cat <<'EOF'
feat: add project features API

EOF
)"
```

---

### Task 6: Feature reminders in the cron job

**Files:**
- Modify: `back/src/jobs/reminderJob.js`
- Modify: `back/tests/jobs/reminderJob.test.js`

**Interfaces:**
- Consumes: `Feature` with `as: 'creator'` User; `sendReminderEmail({ to, note: { title, content } })`.
- Produces: `checkAndSendReminders` also processes due features (`isReminder true`, `remindAt <= now()`, `notifiedAt null`). Email `to: feature.creator.email`, `note: { title: feature.title, content: feature.description || '' }`. Then `notifiedAt = now()`. Return value = notes sent + features sent. Existing note tests must keep passing (first test still `sentCount === 1` if no due features exist). New tests: due feature sends once; second call does not resend.

- [ ] **Step 1: Add failing tests to `back/tests/jobs/reminderJob.test.js`**

Import `Feature` and `Project`. In `beforeAll` create a project for feature tests (or create inside the test). Add:

```javascript
  it('sends an email for a due feature reminder and does not resend', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    mailer.__setTransporterForTests({ sendMail });
    const project = await Project.create({ name: 'Website Revamp' });
    const feature = await Feature.create({
      projectId: project.id,
      userId: user.id,
      title: 'Ship SSO',
      description: 'Check IdP',
      isReminder: true,
      remindAt: new Date(Date.now() - 1000),
    });

    const first = await checkAndSendReminders();
    expect(first).toBeGreaterThanOrEqual(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: 'Recordatorio: Ship SSO',
        text: 'Check IdP',
      })
    );
    await feature.reload();
    expect(feature.notifiedAt).not.toBeNull();

    sendMail.mockClear();
    const second = await checkAndSendReminders();
    expect(sendMail).not.toHaveBeenCalled();
    expect(second).toBe(0);
  });
```

Note: `sendReminderEmail` uses `subject: Recordatorio: ${note.title}` and `text: note.content`. Assert via `sendMail` mock as existing tests do (`toHaveBeenCalledTimes`), **or** match `sendMail` args. Existing first test uses `toHaveBeenCalledTimes(1)` without inspecting args — keep that. If this new test runs in the same file **after** notes have already been notified, `first` might only count the feature (0 leftover notes). Create the feature test so it does not depend on leftover due notes: the `does not resend` note test already notified the first note. Order: add the feature test after the existing ones so `second` is 0 if nothing else is due. The `first` `toBeGreaterThanOrEqual(1)` is enough; also `expect(sendMail).toHaveBeenCalled()` and reload `notifiedAt`.

If `user` in this file is a developer, that is fine: the job emails `creator.email`, not a role check.

- [ ] **Step 2: Run test to verify the new case fails**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/jobs/reminderJob.test.js
```

Expected: FAIL (features not sent / Feature not included).

- [ ] **Step 3: Write minimal implementation**

Replace `checkAndSendReminders` in `back/src/jobs/reminderJob.js`:

```javascript
const { Note, User, Feature } = require('../models');

async function checkAndSendReminders() {
  let sent = 0;
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
    sent += 1;
  }

  const dueFeatures = await Feature.findAll({
    where: {
      isReminder: true,
      remindAt: { [Op.lte]: new Date() },
      notifiedAt: null,
    },
    include: { model: User, as: 'creator' },
  });
  for (const feature of dueFeatures) {
    await sendReminderEmail({
      to: feature.creator.email,
      note: { title: feature.title, content: feature.description || '' },
    });
    feature.notifiedAt = new Date();
    await feature.save();
    sent += 1;
  }

  return sent;
}
```

Keep `startReminderJob` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test -- tests/jobs/reminderJob.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/jobs/reminderJob.js back/tests/jobs/reminderJob.test.js
git commit -m "$(cat <<'EOF'
feat: email due feature reminders to the creating admin

EOF
)"
```

---

### Task 7: Features card on project detail

**Files:**
- Create: `front/src/api/features.js`
- Create: `front/src/components/projects/ProjectFeaturesCard.jsx`
- Test: `front/src/components/projects/ProjectFeaturesCard.test.jsx`
- Modify: `front/src/pages/ProjectDetailPage.jsx`
- Modify: `front/src/pages/ProjectDetailPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()`, `listFeatures`, `createFeature`, `deleteFeature`.
- Produces: Card title `Features`. Empty `Sin features`. Status labels `Pendiente` / `Hecho`. Admin: button `Nuevo feature` opens a form (título, descripción, select estado, checkbox recordatorio + datetime `datetime-local` like notes). Developer: no `Nuevo feature`, no `Quitar`. Page mounts `<ProjectFeaturesCard projectId={project.id} />` for anyone who can see the project (admin and developer). Existing developer test still hides `Finanzas`; assert it **does** show `Features`.

- [ ] **Step 1: Write the failing tests**

Create `front/src/components/projects/ProjectFeaturesCard.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import ProjectFeaturesCard from './ProjectFeaturesCard';
import * as featuresApi from '../../api/features';

function renderCard(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <ProjectFeaturesCard projectId={7} />
    </AuthContext.Provider>
  );
}

describe('ProjectFeaturesCard', () => {
  it('lets an admin create a feature', async () => {
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'createFeature').mockResolvedValue({
      id: 3,
      title: 'SSO',
      description: 'Login',
      status: 'pending',
      isReminder: false,
    });

    renderCard('admin');
    expect(await screen.findByText('Sin features')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Nuevo feature'));
    });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'SSO' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Login' } });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(featuresApi.createFeature).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ title: 'SSO', description: 'Login' })
      )
    );
    expect(await screen.findByText('SSO')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('hides write controls for a developer', async () => {
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([
      { id: 3, title: 'SSO', description: 'Login', status: 'done' },
    ]);
    renderCard('developer');
    expect(await screen.findByText('SSO')).toBeInTheDocument();
    expect(screen.getByText('Hecho')).toBeInTheDocument();
    expect(screen.queryByText('Nuevo feature')).not.toBeInTheDocument();
    expect(screen.queryByText('Quitar')).not.toBeInTheDocument();
  });
});
```

In `ProjectDetailPage.test.jsx`, mock `listFeatures` to `[]` in existing tests. In the developer test, after Website Revamp:

```javascript
expect(screen.getByText('Features')).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/projects/ProjectFeaturesCard.test.jsx src/pages/ProjectDetailPage.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `front/src/api/features.js`:

```javascript
import api from './client';

export async function listFeatures(projectId) {
  const res = await api.get(`/projects/${projectId}/features`);
  return res.data;
}

export async function createFeature(projectId, data) {
  const res = await api.post(`/projects/${projectId}/features`, data);
  return res.data;
}

export async function deleteFeature(projectId, featureId) {
  await api.delete(`/projects/${projectId}/features/${featureId}`);
}
```

`ProjectFeaturesCard.jsx`: load list on `projectId`. Admin uses the same Dialog pattern as `NoteFormModal` (`Nueva nota` → here `Nuevo feature`, submit `Guardar`). Payload `{ title, description, status, isReminder, remindAt: isReminder ? remindAt : undefined }`. Status select values `pending` / `done`, visible `Pendiente` / `Hecho`. List each feature with title, description, status label, and admin `Quitar`.

Mount after the finance card (finance still admin-only):

```jsx
<ProjectFeaturesCard projectId={project.id} />
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\back"
npm test
```

Expected: all frontend and backend tests PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/features.js front/src/components/projects/ProjectFeaturesCard.jsx front/src/components/projects/ProjectFeaturesCard.test.jsx front/src/pages/ProjectDetailPage.jsx front/src/pages/ProjectDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: show project features read-only for developers

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| FinanceItem fields, kinds, createdBy | 1 |
| Admin CRUD finance, hasFile, no storedName, developer 403 | 2 |
| Optional PDF/image 10 MB, download Content-Disposition, delete removes file | 2 |
| Finanzas UI sections, Total budget, hidden from developer | 3 |
| Feature model + reminder columns | 4 |
| Features GET member/admin, writes admin | 5 |
| isReminder false clears remindAt, keeps notifiedAt | 5 |
| Cron emails creating admin, one-shot | 6 |
| Features card copy, developer read-only | 7 |
| Notes/Kanban/members untouched (except detail mounts) | 3, 7 |

No TBD placeholders. Names (`toPublicFinanceItem`, `listFinance`, `listFeatures`, `hasFile`, `creator`) are consistent across tasks.
