# Project-page tasks, rich text, assignment email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins create and assign tasks from the project page; task descriptions are sanitized rich text; assignees get an email when they are newly assigned.

**Architecture:** Keep `Task.description` as TEXT storing sanitized HTML. `sanitizeDescription` runs on create/update. `sendTaskAssignedEmail` reuses the existing nodemailer transporter. The project page reuses `TaskFormModal`. One TipTap editor is shared by the create modal and task detail.

**Tech Stack:** Express, Sequelize, React 19, Vitest/Jest, `sanitize-html` (backend), TipTap + `dompurify` (frontend). Existing SMTP env vars.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-15-project-task-create-richtext-email-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. Kanban columns, membership, finance, features, and notes stay unchanged.
- Error bodies `{ error: string }`. New exact strings: `Invalid assignee`, `Invalid description`. Keep existing strings. Replace today's developer-only `'Assignee must be a project member'` with `Invalid assignee` for **every** actor.
- Exact UI copy: `Nueva tarea`. Project empty list: `Aún no hay tareas`.
- Assignee dropdown = `GET /projects/:id/members` only. Assignee optional.
- Toolbar only: bold, italic, underline, h1–h3, highlight (`<mark>`), lists, links. No images, tables, or color picker.
- Description allowlist: `p br strong b em i u h1 h2 h3 ul ol li mark a[href]` with `href` schemes `http` `https` `mailto`. Empty HTML → `null`. Max **20000** chars after sanitize.
- Email subject: `Nueva tarea: {task.title}`. SMTP failure or missing `SMTP_HOST` must not fail the HTTP request.
- `FRONTEND_URL` has no trailing slash; if unset, omit the link.
- TDD: failing test first. Commit after each task. Do not push.
- Do not implement on a dirty `master`. At execution time use `superpowers:using-git-worktrees` on a branch such as `feat/project-task-create-richtext-email`.

## File map

| File | Role |
|---|---|
| `back/src/utils/sanitizeDescription.js` | HTML allowlist + empty → null + length cap |
| `back/src/utils/mailer.js` | `sendTaskAssignedEmail` |
| `back/src/controllers/tasksController.js` | Member assignee for admin; sanitize; notify |
| `front/src/lib/sanitizeTaskHtml.js` | Client allowlist for render |
| `front/src/components/tasks/TaskDescriptionEditor.jsx` | TipTap toolbar |
| `front/src/components/kanban/TaskFormModal.jsx` | Editor instead of textarea |
| `front/src/api/tasks.js` | `updateTask` |
| `front/src/pages/TaskDetailPage.jsx` | Sanitized HTML + edit |
| `front/src/components/projects/ProjectTasksCard.jsx` | Admin task list + Nueva tarea |
| `front/src/pages/ProjectDetailPage.jsx` | Mount card for admin |

---

### Task 1: sanitizeDescription

**Files:**
- Create: `back/src/utils/sanitizeDescription.js`
- Test: `back/tests/utils/sanitizeDescription.test.js`

**Interfaces:**
- Consumes: `sanitize-html`.
- Produces: `MAX_TASK_DESCRIPTION_LENGTH = 20000`. `function sanitizeDescription(html)` → `string | null`. Throws `Error` with `message === 'Invalid description'` when cleaned length > 20000.

- [ ] **Step 1: Install dependency**

```bash
cd back
npm install sanitize-html
```

- [ ] **Step 2: Write the failing test**

Create `back/tests/utils/sanitizeDescription.test.js`:

```javascript
const { sanitizeDescription, MAX_TASK_DESCRIPTION_LENGTH } = require('../../src/utils/sanitizeDescription');

describe('sanitizeDescription', () => {
  it('keeps allowlisted markup and strips scripts', () => {
    const clean = sanitizeDescription(
      '<p>Hello <strong>x</strong><script>alert(1)</script></p><a href="https://ex.com">l</a>'
    );
    expect(clean).toContain('<strong>x</strong>');
    expect(clean).toContain('href="https://ex.com"');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('alert');
  });

  it('returns null for empty or blank html', () => {
    expect(sanitizeDescription(null)).toBeNull();
    expect(sanitizeDescription('')).toBeNull();
    expect(sanitizeDescription('<p></p>')).toBeNull();
    expect(sanitizeDescription('<p>   </p>')).toBeNull();
  });

  it('strips javascript urls', () => {
    const clean = sanitizeDescription('<a href="javascript:alert(1)">x</a>');
    expect(clean).not.toMatch(/javascript:/i);
  });

  it('throws Invalid description when over the cap', () => {
    expect(MAX_TASK_DESCRIPTION_LENGTH).toBe(20000);
    const huge = `<p>${'a'.repeat(20001)}</p>`;
    expect(() => sanitizeDescription(huge)).toThrow('Invalid description');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd back
npm test -- tests/utils/sanitizeDescription.test.js
```

Expected: FAIL (`Cannot find module` for `sanitizeDescription`).

- [ ] **Step 4: Write minimal implementation**

Create `back/src/utils/sanitizeDescription.js`:

```javascript
const sanitizeHtml = require('sanitize-html');

const MAX_TASK_DESCRIPTION_LENGTH = 20000;

const OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'mark', 'a'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};

function sanitizeDescription(html) {
  if (html == null || html === '') return null;
  const clean = sanitizeHtml(String(html), OPTIONS).trim();
  const text = clean.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  if (!text) return null;
  if (clean.length > MAX_TASK_DESCRIPTION_LENGTH) {
    throw new Error('Invalid description');
  }
  return clean;
}

module.exports = { sanitizeDescription, MAX_TASK_DESCRIPTION_LENGTH };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd back
npm test -- tests/utils/sanitizeDescription.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add back/package.json back/package-lock.json back/src/utils/sanitizeDescription.js back/tests/utils/sanitizeDescription.test.js
git commit -m "$(cat <<'EOF'
feat: sanitize task description HTML on the server

EOF
)"
```

---

### Task 2: Assignee membership and sanitized create/update

**Files:**
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/tests/routes/tasks.test.js`

**Interfaces:**
- Consumes: `sanitizeDescription`, `isProjectMember`.
- Produces: `POST`/`PUT` with non-member `assigneeId` → `400 { error: 'Invalid assignee' }` for admin and developer. Description sanitized (or `400 { error: 'Invalid description' }`). Empty HTML stored as `null`.

- [ ] **Step 1: Write the failing tests**

In `back/tests/routes/tasks.test.js` change the existing developer non-member case to expect `Invalid assignee`, and add:

```javascript
  it('admin cannot assign a non-member', async () => {
    const stranger = await User.create({
      name: 'Outsider',
      email: 'outsider@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Nope', assigneeId: stranger.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid assignee' });
  });

  it('strips script tags from description and keeps strong', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({
        projectId: project.id,
        title: 'Rich',
        description: '<p>Hi <strong>there</strong><script>alert(1)</script></p>',
      });
    expect(res.status).toBe(201);
    expect(res.body.description).toContain('<strong>there</strong>');
    expect(res.body.description).not.toContain('script');
  });

  it('stores blank html description as null', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Empty html', description: '<p></p>' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
  });

  it('rejects an oversized description', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({
        projectId: project.id,
        title: 'Too big',
        description: `<p>${'a'.repeat(20001)}</p>`,
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid description' });
  });
```

Also change:

```javascript
    expect(res.body).toEqual({ error: 'Assignee must be a project member' });
```

to:

```javascript
    expect(res.body).toEqual({ error: 'Invalid assignee' });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd back
npm test -- tests/routes/tasks.test.js
```

Expected: FAIL (`Invalid assignee` not returned for admin; description still contains `script`).

- [ ] **Step 3: Write minimal implementation**

In `tasksController.js` require `{ sanitizeDescription }` from `../utils/sanitizeDescription`.

Add:

```javascript
function applyDescription(target, raw) {
  try {
    target.description = sanitizeDescription(raw);
    return null;
  } catch (err) {
    if (err.message === 'Invalid description') {
      return { error: 'Invalid description' };
    }
    throw err;
  }
}

async function assertAssigneeMember(assigneeId, projectId) {
  if (assigneeId == null || assigneeId === '') return null;
  const ok = await isProjectMember(assigneeId, projectId);
  if (!ok) return { error: 'Invalid assignee' };
  return null;
}
```

In `create`, **for every role** (move the assignee check out of the developer-only block; keep the developer membership check for the creator):

```javascript
  if (req.user.role !== 'admin') {
    const allowed = await isProjectMember(req.user.id, project.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const assigneeError = await assertAssigneeMember(assigneeId, project.id);
  if (assigneeError) return res.status(400).json(assigneeError);
  let descriptionHtml;
  try {
    descriptionHtml = sanitizeDescription(description);
  } catch (err) {
    if (err.message === 'Invalid description') {
      return res.status(400).json({ error: 'Invalid description' });
    }
    throw err;
  }
```

Pass `description: descriptionHtml` into `Task.create`.

In `update`, before mutating assignee/description:

```javascript
  const nextProjectIdForAssignee =
    req.user.role === 'admin' && req.body.projectId !== undefined
      ? Number(req.body.projectId)
      : task.projectId;
  if (req.body.assigneeId !== undefined) {
    const assigneeError = await assertAssigneeMember(req.body.assigneeId, nextProjectIdForAssignee);
    if (assigneeError) return res.status(400).json(assigneeError);
  }
```

When `description !== undefined` (admin branch and developer branch), assign via `sanitizeDescription` and return 400 on throw. Treat `assigneeId === ''` as `null`.

- [ ] **Step 4: Run tests**

```bash
cd back
npm test -- tests/routes/tasks.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/tasksController.js back/tests/routes/tasks.test.js
git commit -m "$(cat <<'EOF'
feat: require member assignees and sanitize task HTML

EOF
)"
```

---

### Task 3: Assignment email

**Files:**
- Modify: `back/src/utils/mailer.js`
- Modify: `back/tests/utils/mailer.test.js`
- Modify: `back/src/controllers/tasksController.js`
- Modify: `back/tests/routes/tasks.test.js`

**Interfaces:**
- Consumes: existing `getTransporter`, `SMTP_FROM`, `SMTP_HOST`, `FRONTEND_URL`.
- Produces: `async function sendTaskAssignedEmail({ to, task, project, assigner })`. Subject `Nueva tarea: ${task.title}`. Called after successful create when `assigneeId` is set, and after PUT when assignee changes to a different non-null user. Errors are swallowed; HTTP still 201/200.

- [ ] **Step 1: Write the failing mailer test**

Append to `back/tests/utils/mailer.test.js`:

```javascript
const { sendReminderEmail, sendTaskAssignedEmail, __setTransporterForTests } = require('../../src/utils/mailer');

describe('sendTaskAssignedEmail', () => {
  const originalHost = process.env.SMTP_HOST;
  const originalFront = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.SMTP_HOST = originalHost;
    process.env.FRONTEND_URL = originalFront;
  });

  it('sends subject and link when SMTP and FRONTEND_URL are set', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.FRONTEND_URL = 'https://app.example.com';
    const sendMail = jest.fn().mockResolvedValue({});
    __setTransporterForTests({ sendMail });

    await sendTaskAssignedEmail({
      to: 'dev@example.com',
      task: { id: 9, title: 'Fix nav' },
      project: { name: 'Website Revamp' },
      assigner: { name: 'Ada' },
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@example.com',
        subject: 'Nueva tarea: Fix nav',
        text: expect.stringContaining('https://app.example.com/tasks/9'),
      })
    );
    expect(sendMail.mock.calls[0][0].text).toContain('Website Revamp');
    expect(sendMail.mock.calls[0][0].text).toContain('Ada');
  });

  it('skips sendMail when SMTP_HOST is unset', async () => {
    delete process.env.SMTP_HOST;
    const sendMail = jest.fn();
    __setTransporterForTests({ sendMail });
    await sendTaskAssignedEmail({
      to: 'dev@example.com',
      task: { id: 1, title: 'T' },
      project: { name: 'P' },
      assigner: { name: 'A' },
    });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
```

Keep the existing `sendReminderEmail` test; add `sendTaskAssignedEmail` to that file's require.

- [ ] **Step 2: Run mailer test to verify it fails**

```bash
cd back
npm test -- tests/utils/mailer.test.js
```

Expected: FAIL (`sendTaskAssignedEmail` is not a function).

- [ ] **Step 3: Implement sendTaskAssignedEmail**

In `mailer.js`:

```javascript
async function sendTaskAssignedEmail({ to, task, project, assigner }) {
  if (!process.env.SMTP_HOST) {
    console.error('SMTP_HOST unset; skip assignment email');
    return;
  }
  const lines = [
    `Proyecto: ${project.name}`,
    `Asignado por: ${assigner.name}`,
    `Tarea: ${task.title}`,
  ];
  const base = process.env.FRONTEND_URL;
  if (base) {
    lines.push(`Enlace: ${base.replace(/\/$/, '')}/tasks/${task.id}`);
  }
  const client = getTransporter();
  await client.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Nueva tarea: ${task.title}`,
    text: lines.join('\n'),
  });
}

module.exports = { sendReminderEmail, sendTaskAssignedEmail, __setTransporterForTests };
```

- [ ] **Step 4: Write failing route tests for notify**

In `tasks.test.js` require `const mailer = require('../../src/utils/mailer');` and add:

```javascript
  it('emails the assignee on create and not when unassigned', async () => {
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockResolvedValue();
    const assigned = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Paged', assigneeId: developer.id });
    expect(assigned.status).toBe(201);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].to).toBe('dev@example.com');
    spy.mockClear();
    const open = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Unassigned' });
    expect(open.status).toBe(201);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emails only when PUT changes the assignee', async () => {
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockResolvedValue();
    const same = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', adminCookie)
      .send({ assigneeId: developer.id });
    expect(same.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
    const changed = await request(app)
      .put(`/tasks/${assignedTask.id}`)
      .set('Cookie', adminCookie)
      .send({ assigneeId: otherDeveloper.id });
    expect(changed.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].to).toBe('dev2@example.com');
    spy.mockRestore();
  });

  it('still creates the task when assignment email throws', async () => {
    const spy = jest.spyOn(mailer, 'sendTaskAssignedEmail').mockRejectedValue(new Error('smtp down'));
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', adminCookie)
      .send({ projectId: project.id, title: 'Mail fail', assigneeId: developer.id });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Mail fail');
    spy.mockRestore();
  });
```

`otherDeveloper` is already a member from the earlier create-assigned-to-another-member test. If that test's `ProjectMember.create` can throw on duplicate in a re-run of a subset, use `findOrCreate` in the new test instead.

- [ ] **Step 5: Run route tests to verify they fail**

```bash
cd back
npm test -- tests/routes/tasks.test.js
```

Expected: FAIL (spy not called).

- [ ] **Step 6: Wire notify into the controller**

Require `{ sendTaskAssignedEmail }` from `../utils/mailer`.

```javascript
async function notifyNewAssignee(task, assigner) {
  if (!task.assigneeId) return;
  try {
    const [assignee, project] = await Promise.all([
      User.findByPk(task.assigneeId),
      Project.findByPk(task.projectId),
    ]);
    if (!assignee || !project) return;
    await sendTaskAssignedEmail({
      to: assignee.email,
      task,
      project,
      assigner: { name: assigner.name, id: assigner.id },
    });
  } catch (err) {
    console.error(err);
  }
}
```

`req.user` from JWT may lack `name`. Load `const actor = await User.findByPk(req.user.id)` before notify, or pass `{ name: actor.name }`.

After `await t.commit()` in `create`, `await notifyNewAssignee(task, actor)` then `return res.status(201).json(task)`.

In `update`, capture `const previousAssigneeId = task.assigneeId` **before** assigning new fields. After `await task.save()`, if `task.assigneeId` is not null and `Number(task.assigneeId) !== Number(previousAssigneeId)`, `await notifyNewAssignee(task, actor)`.

- [ ] **Step 7: Run tests**

```bash
cd back
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add back/src/utils/mailer.js back/tests/utils/mailer.test.js back/src/controllers/tasksController.js back/tests/routes/tasks.test.js
git commit -m "$(cat <<'EOF'
feat: email developers when a task is assigned to them

EOF
)"
```

---

### Task 4: TipTap editor in create modal and task detail

**Files:**
- Create: `front/src/lib/sanitizeTaskHtml.js`
- Create: `front/src/lib/sanitizeTaskHtml.test.js`
- Create: `front/src/components/tasks/TaskDescriptionEditor.jsx`
- Modify: `front/src/components/kanban/TaskFormModal.jsx`
- Modify: `front/src/components/kanban/TaskFormModal.test.jsx`
- Modify: `front/src/api/tasks.js`
- Modify: `front/src/pages/TaskDetailPage.jsx`
- Modify: `front/src/pages/TaskDetailPage.test.jsx`

**Interfaces:**
- Consumes: TipTap, `dompurify`, `updateTask(id, data)`.
- Produces: `sanitizeTaskHtml(html)` for render. `TaskDescriptionEditor({ value, onChange, editable = true, ariaLabel = 'Descripción' })`. Modal and detail share it. Failed detail save keeps previous HTML and shows `error`.

- [ ] **Step 1: Install frontend packages**

```bash
cd front
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-highlight @tiptap/extension-link @tiptap/extension-placeholder dompurify
```

- [ ] **Step 2: Write failing sanitizer test**

Create `front/src/lib/sanitizeTaskHtml.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { sanitizeTaskHtml } from './sanitizeTaskHtml';

describe('sanitizeTaskHtml', () => {
  it('keeps strong and drops script', () => {
    const html = sanitizeTaskHtml('<p><strong>ok</strong><script>alert(1)</script></p>');
    expect(html).toContain('<strong>ok</strong>');
    expect(html).not.toContain('script');
  });
});
```

- [ ] **Step 3: Run it to verify fail**

```bash
cd front
npx vitest run src/lib/sanitizeTaskHtml.test.js
```

Expected: FAIL (module missing).

- [ ] **Step 4: Implement sanitizeTaskHtml**

Create `front/src/lib/sanitizeTaskHtml.js`:

```javascript
import DOMPurify from 'dompurify';

const CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'mark', 'a'],
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/)/i,
};

export function sanitizeTaskHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, CONFIG);
}
```

- [ ] **Step 5: Implement TaskDescriptionEditor**

Create `front/src/components/tasks/TaskDescriptionEditor.jsx`:

```jsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

export default function TaskDescriptionEditor({
  value,
  onChange,
  editable = true,
  ariaLabel = 'Descripción',
}) {
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: 'Descripción' }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, false);
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div>
      {editable && (
        <div className="mb-1 flex flex-wrap gap-1 text-xs">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>N</button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}>S</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()}>Resaltar</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>Lista</button>
        </div>
      )}
      <div aria-label={ariaLabel} className="rounded border border-border bg-background px-2 py-1 text-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

Do not add a color picker or image button.

- [ ] **Step 6: Wire TaskFormModal**

Replace the description `Textarea` with:

```jsx
<Label>Descripción</Label>
<TaskDescriptionEditor value={description} onChange={setDescription} />
```

Submit `description` as today (server sanitizes). Keep Título / Asignar a / Fecha límite.

In `TaskFormModal.test.jsx` mock the editor (modal lives in `components/kanban/`, editor in `components/tasks/`):

```javascript
vi.mock('../tasks/TaskDescriptionEditor', () => ({
  default: function MockEditor({ value, onChange }) {
    return (
      <textarea
        aria-label="Descripción"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
}));
```

- [ ] **Step 7: Task detail view + edit**

Add to `front/src/api/tasks.js`:

```javascript
export async function updateTask(id, data) {
  const res = await api.put(`/tasks/${id}`, data);
  return res.data;
}
```

`TaskDetailPage.jsx`: import `useAuth`, `sanitizeTaskHtml`, `TaskDescriptionEditor`, `updateTask`.

Replace `<p>{task.description}</p>` with:

- If `user.role === 'admin' || String(user.id) === String(task.assigneeId)`: `TaskDescriptionEditor` bound to local `description` state initialized from `task.description`, plus a **Guardar** button that `PUT`s `{ description }`. On error, keep previous description and render `err.response?.data?.error || err.message`.
- Else: `<div dangerouslySetInnerHTML={{ __html: sanitizeTaskHtml(task.description) }} />`.

Initialize description state when `task` loads.

Add test in `TaskDetailPage.test.jsx`: mock `updateTask`; render as assignee via `AuthContext` if the page uses it; description HTML `<p>Hi <strong>there</strong></p>` appears as **there** (getByText). Mock `TaskDescriptionEditor` the same way if edit chrome makes the test noisy — still assert sanitized **view** for a non-assignee developer: wrap `AuthContext` with `{ id: 99, role: 'developer' }` and expect `there` and no Guardar.

Provide `AuthContext` in existing tests (user admin) so the page does not crash.

- [ ] **Step 8: Run frontend tests**

```bash
cd front
npx vitest run src/lib/sanitizeTaskHtml.test.js src/components/kanban/TaskFormModal.test.jsx src/pages/TaskDetailPage.test.jsx
npx vitest run
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add front/package.json front/package-lock.json front/src/lib/sanitizeTaskHtml.js front/src/lib/sanitizeTaskHtml.test.js front/src/components/tasks/TaskDescriptionEditor.jsx front/src/components/kanban/TaskFormModal.jsx front/src/components/kanban/TaskFormModal.test.jsx front/src/api/tasks.js front/src/pages/TaskDetailPage.jsx front/src/pages/TaskDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: add a shared rich-text editor for task descriptions

EOF
)"
```

---

### Task 5: Tareas card on the project page

**Files:**
- Create: `front/src/components/projects/ProjectTasksCard.jsx`
- Modify: `front/src/pages/ProjectDetailPage.jsx`
- Modify: `front/src/pages/ProjectDetailPage.test.jsx`

**Interfaces:**
- Consumes: `listTasks({ projectId })`, `listColumns(projectId)`, `listMembers(projectId)`, `TaskFormModal`, `useAuth`.
- Produces: Admin-only card titled `Tareas` with **Nueva tarea**, list of title (link `/tasks/:id`), assignee name or `Sin asignar`, column name. Empty: `Aún no hay tareas`. Developers do not render the card.

- [ ] **Step 1: Write the failing tests**

In `ProjectDetailPage.test.jsx` import `* as tasksApi` and `* as columnsApi`. Mock `listTasks` / `listColumns` in **every** existing test (return `[]`) so fetches do not leak. Add:

```javascript
  it('lets an admin see Nueva tarea and a task row', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'active' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([{ id: 2, name: 'Dev' }]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([
      { id: 11, title: 'Build homepage', projectId: 7, assigneeId: 2, columnId: 3 },
    ]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([
      { id: 3, name: 'To Do', position: 0, projectId: 7 },
    ]);

    renderPage();

    expect(await screen.findByText('Tareas')).toBeInTheDocument();
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Build homepage' })).toHaveAttribute('href', '/tasks/11');
    expect(screen.getByText('Dev')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('does not show the Tareas card to a developer', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'active' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    render(
      <AuthContext.Provider
        value={{ user: { id: 2, name: 'Dev', role: 'developer' }, loading: false }}
      >
        <MemoryRouter initialEntries={['/projects/7']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
    expect(screen.queryByText('Tareas')).not.toBeInTheDocument();
    expect(screen.queryByText('Nueva tarea')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd front
npx vitest run src/pages/ProjectDetailPage.test.jsx
```

Expected: FAIL (no `Tareas`).

- [ ] **Step 3: Implement ProjectTasksCard and mount it**

Create `front/src/components/projects/ProjectTasksCard.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as tasksApi from '../../api/tasks';
import * as columnsApi from '../../api/columns';
import * as projectsApi from '../../api/projects';
import TaskFormModal from '../kanban/TaskFormModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectTasksCard({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    tasksApi.listTasks({ projectId }).then(setTasks);
    columnsApi.listColumns(projectId).then(setColumns);
    projectsApi.listMembers(projectId).then(setMembers);
  }, [projectId]);

  function handleCreated(task) {
    setTasks((prev) => [...prev, task]);
  }

  const columnName = (columnId) => columns.find((c) => String(c.id) === String(columnId))?.name || '';
  const memberName = (assigneeId) =>
    members.find((m) => String(m.id) === String(assigneeId))?.name || 'Sin asignar';

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tareas</CardTitle>
        <TaskFormModal projectId={projectId} users={members} onCreated={handleCreated} />
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay tareas</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap gap-2">
                <Link to={`/tasks/${task.id}`} className="text-primary hover:underline">
                  {task.title}
                </Link>
                <span className="text-muted-foreground">{memberName(task.assigneeId)}</span>
                <span className="text-muted-foreground">{columnName(task.columnId)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

In `ProjectDetailPage.jsx` import it and render `{user.role === 'admin' && <ProjectTasksCard projectId={project.id} />}` next to the other cards (after members is fine).

Mock `listTasks`/`listColumns` as `[]` in the two existing tests that do not add those spies.

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
git add front/src/components/projects/ProjectTasksCard.jsx front/src/pages/ProjectDetailPage.jsx front/src/pages/ProjectDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: let admins create tasks from the project page

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Admin Tareas card + Nueva tarea; developer no card | 5 |
| Same TaskFormModal; members-only assignee select | 5 (reuses modal from 4) |
| POST without columnId → first column | already shipped; create from modal omits columnId |
| `Invalid assignee` for admin and developer | 2 |
| Sanitize HTML; empty → null; max 20000 → `Invalid description` | 1–2 |
| TipTap on project, Kanban, detail | 4 (modal shared) + 5 |
| Cards still title-only | unchanged TaskCard |
| Email on create with assignee; PUT change; not same/null; SMTP fail still 201 | 3 |
| FRONTEND_URL optional link | 3 |
| No new role / activity type / images | all |
