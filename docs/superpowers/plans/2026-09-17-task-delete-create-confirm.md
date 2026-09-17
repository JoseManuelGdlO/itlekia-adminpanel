# Task delete UI and create confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins delete a task from detail (with cascade + confirm), and require a second confirm before `POST /tasks` so Guardar cannot double-create.

**Architecture:** Keep `DELETE /tasks/:id` admin-only; replace `task.destroy()` with the same transactional child-delete order as project delete’s task slice. Front adds `deleteTask`, an Eliminar dialog on `TaskDetailView`, and a second Crear dialog in `TaskFormModal` that is the only path that calls `createTask`.

**Tech Stack:** Express, Sequelize, React, Jest/supertest, Vitest/Testing Library, existing shadcn `Dialog`/`Button`. No new dependencies.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-17-task-delete-create-confirm-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. Delete UI only when `user.role === 'admin'`. `DELETE /tasks/:id` stays `requireRole('admin')`.
- Error bodies `{ error: string }`. No new error strings. Unknown task `404 { error: 'Task not found' }`. Developer delete `403 { error: 'Forbidden' }`. 500 stays `Internal server error`.
- Delete copy: dialog title `Eliminar`; body `¿Eliminar {título}? Se borran notas e historial de la tarea.`; actions **Cancelar** / **Eliminar**.
- Create copy: dialog title `Crear`; body `¿Crear {título}?`; actions **Cancelar** / **Crear**.
- Notes CRUD UI and `DELETE /notes` do not change. No delete on the Kanban card or project task list. No idempotency key. No duplicate-title warning.
- A note cannot have both `projectId` and `taskId` (model validator). Cascade `where: { taskId }`. Sibling project notes (`projectId` set, `taskId` null) stay.
- TDD: failing test first. Commit after each task. Do not push.
- Do not implement on a dirty `master`. At execution time use `superpowers:using-git-worktrees` on `feat/task-delete-create-confirm`. If the spec/plan are still untracked, copy or commit them onto that branch first so later tasks can follow the spec.

## File map

| File | Role |
|---|---|
| `back/src/controllers/tasksController.js` | Transactional cascade on `remove` |
| `front/src/api/tasks.js` | `deleteTask(id)` |
| `front/src/components/tasks/TaskDetailView.jsx` | Admin Eliminar + confirm + `onDeleted` |
| `front/src/components/tasks/TaskDetailModal.jsx` | Forward `onDeleted` |
| `front/src/pages/KanbanPage.jsx` | Close modal and drop the card |
| `front/src/pages/TaskDetailPage.jsx` | `navigate('/kanban')` after delete |
| `front/src/components/kanban/TaskFormModal.jsx` | Confirm, then one POST; disable while pending |

---

### Task 1: Cascade `DELETE /tasks/:id`

**Files:**
- Modify: `back/src/controllers/tasksController.js` (imports + `remove`)
- Test: `back/tests/routes/tasks.test.js`

**Interfaces:**
- Consumes: existing `DELETE /tasks/:id` (`requireAuth` + `requireRole('admin')`).
- Produces: `remove` still returns `204` / `404 { error: 'Task not found' }`; children (`NoteNotify`, `Note` with that `taskId`, `TaskActivity`) are gone after success.

- [ ] **Step 1: Write the failing tests**

In `back/tests/routes/tasks.test.js`, add `Note` and `NoteNotify` to the models import:

```javascript
const {
  sequelize,
  User,
  Project,
  ProjectMember,
  Task,
  TaskActivity,
  BoardColumn,
  Note,
  NoteNotify,
} = require('../../src/models');
```

Append these cases after the existing `it('admin deletes a task', ...)` (keep that case):

```javascript
  it('admin delete cascades notes, notifies, and activity and keeps sibling project notes', async () => {
    await sequelize.query('PRAGMA foreign_keys = ON');
    try {
      const doomed = await Task.create({
        projectId: project.id,
        title: 'Doomed task',
        columnId: todoCol.id,
      });
      const taskNote = await Note.create({
        taskId: doomed.id,
        title: 'Task note',
        content: 'Delete with task',
        userId: developer.id,
      });
      const sibling = await Note.create({
        projectId: project.id,
        title: 'Project note',
        content: 'Keep this note',
        userId: developer.id,
      });
      await NoteNotify.create({ noteId: taskNote.id, userId: developer.id });
      await NoteNotify.create({ noteId: sibling.id, userId: developer.id });
      await TaskActivity.create({ taskId: doomed.id, userId: developer.id, type: 'created' });

      const res = await request(app).delete(`/tasks/${doomed.id}`).set('Cookie', adminCookie);

      expect(res.status).toBe(204);
      expect(await Task.findByPk(doomed.id)).toBeNull();
      expect(await Note.findByPk(taskNote.id)).toBeNull();
      expect(await NoteNotify.count({ where: { noteId: taskNote.id } })).toBe(0);
      expect(await TaskActivity.count({ where: { taskId: doomed.id } })).toBe(0);
      expect(await Note.findByPk(sibling.id)).not.toBeNull();
      expect(await NoteNotify.count({ where: { noteId: sibling.id } })).toBe(1);
    } finally {
      await sequelize.query('PRAGMA foreign_keys = OFF');
    }
  });

  it('developer cannot delete a task', async () => {
    const blocked = await Task.create({
      projectId: project.id,
      title: 'Stay',
      columnId: todoCol.id,
    });
    const res = await request(app).delete(`/tasks/${blocked.id}`).set('Cookie', developerCookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    expect(await Task.findByPk(blocked.id)).not.toBeNull();
  });

  it('unknown task delete returns 404', async () => {
    const res = await request(app).delete('/tasks/99999').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Task not found' });
  });

  it('admin can delete a task on a paused project', async () => {
    const paused = await Project.create({ name: 'Paused board', status: 'parado' });
    const [col] = await seedDefaultColumns(paused.id);
    const pausedTask = await Task.create({
      projectId: paused.id,
      title: 'Paused task',
      columnId: col.id,
    });
    const res = await request(app).delete(`/tasks/${pausedTask.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
    expect(await Task.findByPk(pausedTask.id)).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd back && npm test -- tests/routes/tasks.test.js
```

Expected: FAIL. Cascade case still sees the task note / notify / activity (or the destroy throws under `PRAGMA foreign_keys = ON`). Do not implement yet.

- [ ] **Step 3: Implement cascade `remove`**

In `back/src/controllers/tasksController.js`, change the models import to:

```javascript
const { Task, Project, TaskActivity, User, BoardColumn, Note, NoteNotify, sequelize } = require('../models');
```

Replace `remove` with:

```javascript
async function remove(req, res) {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const t = await sequelize.transaction();
  try {
    const notes = await Note.findAll({ where: { taskId: task.id }, attributes: ['id'], transaction: t });
    const noteIds = notes.map((n) => n.id);
    if (noteIds.length) await NoteNotify.destroy({ where: { noteId: noteIds }, transaction: t });
    await Note.destroy({ where: { taskId: task.id }, transaction: t });
    await TaskActivity.destroy({ where: { taskId: task.id }, transaction: t });
    await task.destroy({ transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
  return res.status(204).send();
}
```

Do not add new error strings. Do not call `assertNotPaused`.

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd back && npm test -- tests/routes/tasks.test.js
```

Expected: PASS, including the existing `admin deletes a task` case.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/tasksController.js back/tests/routes/tasks.test.js
git commit -m "$(cat <<'EOF'
feat: cascade notes and activity when deleting a task

EOF
)"
```

---

### Task 2: Admin Eliminar on task detail

**Files:**
- Modify: `front/src/api/tasks.js`
- Modify: `front/src/components/tasks/TaskDetailView.jsx`
- Create: `front/src/components/tasks/TaskDetailView.test.jsx`

**Interfaces:**
- Consumes: `DELETE /tasks/:id` from Task 1.
- Produces:
  - `deleteTask(id)` → `await api.delete(\`/tasks/${id}\`)` (no return body)
  - `TaskDetailView({ taskId, embedded = false, onDeleted })`
  - After `204`, calls `onDeleted?.(task)` with the loaded task object
  - Admin-only **Eliminar**; exact confirm copy using `task.title`

- [ ] **Step 1: Write the failing tests**

Create `front/src/components/tasks/TaskDetailView.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskDetailView from './TaskDetailView';
import * as tasksApi from '../../api/tasks';
import * as notesApi from '../../api/notes';
import * as projectsApi from '../../api/projects';
import { AuthContext } from '../../context/AuthContext';

vi.mock('./TaskDescriptionEditor', () => ({
  default: function MockEditor({ value, onChange }) {
    return (
      <textarea
        aria-label="Descripción"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  },
}));

const task = { id: 9, title: 'Build homepage', description: '<p>Hi</p>', projectId: 7, assigneeId: 1 };

function renderView(user, props = {}) {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter>
        <TaskDetailView taskId={9} {...props} />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function mockDetail() {
  vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([task]);
  vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);
  vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValue([]);
  vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
}

describe('TaskDetailView delete', () => {
  it('shows Eliminar and the exact confirm copy for an admin', async () => {
    mockDetail();
    renderView({ id: 1, role: 'admin' });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    expect(
      screen.getByText('¿Eliminar Build homepage? Se borran notas e historial de la tarea.')
    ).toBeInTheDocument();
    expect(screen.getByText('Eliminar', { selector: '[data-slot="dialog-title"]' })).toBeInTheDocument();
  });

  it('cancels delete without calling deleteTask', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'deleteTask').mockResolvedValueOnce();
    renderView({ id: 1, role: 'admin' });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(tasksApi.deleteTask).not.toHaveBeenCalled();
    expect(
      screen.queryByText('¿Eliminar Build homepage? Se borran notas e historial de la tarea.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Build homepage')).toBeInTheDocument();
  });

  it('hides Eliminar from a developer', async () => {
    mockDetail();
    renderView({ id: 1, role: 'developer' });

    expect(await screen.findByText('Build homepage')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('confirms delete, calls deleteTask, then onDeleted', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'deleteTask').mockResolvedValueOnce();
    const onDeleted = vi.fn();
    renderView({ id: 1, role: 'admin' }, { onDeleted });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    await waitFor(() => expect(tasksApi.deleteTask).toHaveBeenCalledWith(9));
    expect(onDeleted).toHaveBeenCalledWith(expect.objectContaining({ id: 9, title: 'Build homepage' }));
  });

  it('keeps the dialog open and shows the API error when delete fails', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'deleteTask').mockRejectedValueOnce({
      response: { data: { error: 'Forbidden' } },
    });
    const onDeleted = vi.fn();
    renderView({ id: 1, role: 'admin' }, { onDeleted });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(
      screen.getByText('¿Eliminar Build homepage? Se borran notas e historial de la tarea.')
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd front && npm test -- src/components/tasks/TaskDetailView.test.jsx
```

Expected: FAIL (`deleteTask` is not a function, and/or no **Eliminar** button).

- [ ] **Step 3: Implement `deleteTask` and the detail dialog**

Append to `front/src/api/tasks.js`:

```javascript
export async function deleteTask(id) {
  await api.delete(`/tasks/${id}`);
}
```

In `front/src/components/tasks/TaskDetailView.jsx`:

1. Import dialog primitives next to the existing UI imports:

```javascript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
```

2. Change the component signature and add delete state:

```javascript
export default function TaskDetailView({ taskId, embedded = false, onDeleted }) {
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
```

(keep every existing state hook)

3. Add this handler next to `handleAssigneeChange`:

```javascript
  async function handleDelete() {
    setError('');
    try {
      await tasksApi.deleteTask(task.id);
      onDeleted?.(task);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }
```

On failure do **not** close the dialog and do **not** call `onDeleted`.

4. `const canDelete = user?.role === 'admin';`

5. Render the trigger:

- Page (`!embedded`): wrap the existing `h2` in `className="flex items-center gap-2"` and put **Eliminar** beside it when `canDelete`.
- Modal (`embedded`): at the top of the root `div`, when `canDelete`, a `flex justify-end` row with the same button.

Trigger button:

```jsx
<Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
  Eliminar
</Button>
```

6. Dialog (same pattern as `ProjectStatusControls`):

```jsx
      {canDelete && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar</DialogTitle>
            </DialogHeader>
            <p>¿Eliminar {task.title}? Se borran notas e historial de la tarea.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
```

The existing description `{error && ...}` line stays where it is (admin can edit description, so the error is visible). Do not add a Kanban-card delete.

Page header block becomes:

```jsx
        {!embedded && (
          <>
            <p className="text-xs text-muted-foreground">
              <Link to="/kanban" className="text-primary hover:underline">
                Kanban
              </Link>
              <span> / {task.title}</span>
            </p>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-semibold">{task.title}</h2>
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Eliminar
                </Button>
              )}
            </div>
          </>
        )}
        {embedded && canDelete && (
          <div className="flex justify-end">
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              Eliminar
            </Button>
          </div>
        )}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd front && npm test -- src/components/tasks/TaskDetailView.test.jsx src/pages/TaskDetailPage.test.jsx
```

Expected: PASS. Existing `TaskDetailPage` cases still pass (developer still has no **Eliminar**).

- [ ] **Step 5: Commit**

```bash
git add front/src/api/tasks.js front/src/components/tasks/TaskDetailView.jsx front/src/components/tasks/TaskDetailView.test.jsx
git commit -m "$(cat <<'EOF'
feat: let admins confirm and delete a task from detail

EOF
)"
```

---

### Task 3: Close kanban modal and leave the task page

**Files:**
- Modify: `front/src/components/tasks/TaskDetailModal.jsx`
- Modify: `front/src/pages/KanbanPage.jsx`
- Modify: `front/src/pages/TaskDetailPage.jsx`
- Test: `front/src/pages/KanbanPage.test.jsx`
- Test: `front/src/pages/TaskDetailPage.test.jsx`

**Interfaces:**
- Consumes: `TaskDetailView` `onDeleted(task)` and `deleteTask(id)` from Task 2.
- Produces:
  - `TaskDetailModal({ task, onClose, onDeleted })` forwards `onDeleted` to the view
  - `KanbanPage` `handleTaskDeleted(task)` → `setOpenTask(null)` and `setTasks` filter by `id`
  - `TaskDetailPage` `onDeleted={() => navigate('/kanban')}`

- [ ] **Step 1: Write the failing tests**

In `front/src/pages/TaskDetailPage.test.jsx`, add a `/kanban` route to `renderPage`:

```jsx
function renderPage(user = { id: 1, name: 'Ada', role: 'admin' }) {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter initialEntries={['/tasks/9']}>
        <Routes>
          <Route path="/kanban" element={<div>Kanban</div>} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}
```

Append:

```jsx
  it('navigates to kanban after the admin confirms delete', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 9, title: 'Build homepage', description: 'x' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'deleteTask').mockResolvedValueOnce();

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    expect(await screen.findByText('Kanban')).toBeInTheDocument();
    expect(tasksApi.deleteTask).toHaveBeenCalledWith(9);
  });
```

In `front/src/pages/KanbanPage.test.jsx`, append:

```jsx
  it('removes the card and closes the modal after admin delete', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([
      { id: 9, title: 'Own card', columnId: 11, projectId: 1, assigneeId: 1, description: '<p>Hi</p>' },
    ]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValue([]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);
    vi.spyOn(tasksApi, 'deleteTask').mockResolvedValueOnce();

    renderAs('admin');

    fireEvent.click(await screen.findByRole('button', { name: 'Own card' }));
    expect(await screen.findByText('Notas de la tarea')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    await waitFor(() => expect(tasksApi.deleteTask).toHaveBeenCalledWith(9));
    expect(screen.queryByText('Notas de la tarea')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Own card' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd front && npm test -- src/pages/TaskDetailPage.test.jsx src/pages/KanbanPage.test.jsx
```

Expected: FAIL. Detail page still shows the task after confirm; kanban card remains.

- [ ] **Step 3: Wire parents**

`front/src/components/tasks/TaskDetailModal.jsx` — full file:

```jsx
import TaskDetailView from './TaskDetailView';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function TaskDetailModal({ task, onClose, onDeleted }) {
  const open = task != null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{task?.title || 'Tarea'}</DialogTitle>
        </DialogHeader>
        {open && <TaskDetailView taskId={task.id} embedded onDeleted={onDeleted} />}
      </DialogContent>
    </Dialog>
  );
}
```

`front/src/pages/TaskDetailPage.jsx` — full file:

```jsx
import { useNavigate, useParams } from 'react-router-dom';
import TaskDetailView from '../components/tasks/TaskDetailView';

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <TaskDetailView taskId={id} onDeleted={() => navigate('/kanban')} />;
}
```

In `front/src/pages/KanbanPage.jsx`, add next to `handleTaskCreated`:

```javascript
  function handleTaskDeleted(task) {
    setOpenTask(null);
    setTasks((prev) => prev.filter((row) => String(row.id) !== String(task.id)));
  }
```

Change the modal usage to:

```jsx
      <TaskDetailModal
        task={openTask}
        onClose={() => setOpenTask(null)}
        onDeleted={handleTaskDeleted}
      />
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd front && npm test -- src/pages/TaskDetailPage.test.jsx src/pages/KanbanPage.test.jsx src/components/tasks/TaskDetailView.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/components/tasks/TaskDetailModal.jsx front/src/pages/KanbanPage.jsx front/src/pages/TaskDetailPage.jsx front/src/pages/KanbanPage.test.jsx front/src/pages/TaskDetailPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: drop deleted tasks from kanban and the task page

EOF
)"
```

---

### Task 4: Confirm before `POST /tasks`

**Files:**
- Modify: `front/src/components/kanban/TaskFormModal.jsx`
- Modify: `front/src/components/kanban/TaskFormModal.test.jsx`

**Interfaces:**
- Consumes: existing `createTask({ projectId, title, description, assigneeId, dueDate })`.
- Produces: **Guardar** only opens confirm; **Crear** is the only caller of `createTask`; while pending, **Crear** and **Guardar** are `disabled`.

- [ ] **Step 1: Write the failing tests**

Replace `front/src/components/kanban/TaskFormModal.test.jsx` with:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import TaskFormModal from './TaskFormModal';
import * as tasksApi from '../../api/tasks';

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

async function openForm() {
  render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);
  await act(async () => {
    screen.getByText('Nueva tarea').click();
  });
}

async function fillTitle(title) {
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: title } });
}

describe('TaskFormModal', () => {
  it('does not POST when Guardar is clicked', async () => {
    vi.spyOn(tasksApi, 'createTask');
    await openForm();
    await fillTitle('New task');

    await act(async () => {
      screen.getByText('Guardar').click();
    });

    expect(screen.getByText('¿Crear New task?')).toBeInTheDocument();
    expect(tasksApi.createTask).not.toHaveBeenCalled();
  });

  it('cancels create confirm and keeps the form values', async () => {
    vi.spyOn(tasksApi, 'createTask');
    await openForm();
    await fillTitle('New task');

    await act(async () => {
      screen.getByText('Guardar').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Cancelar' }).click();
    });

    expect(tasksApi.createTask).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Crear New task?')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('New task');
  });

  it('creates a task and calls onCreated after Crear', async () => {
    vi.spyOn(tasksApi, 'createTask').mockResolvedValueOnce({ id: 10, title: 'New task', status: 'todo' });
    const onCreated = vi.fn();

    render(
      <TaskFormModal projectId={1} users={[]} onCreated={onCreated} />
    );

    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    expect(screen.getByLabelText('Título')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'New task' } });
      screen.getByText('Guardar').click();
    });

    expect(tasksApi.createTask).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(tasksApi.createTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: 1, title: 'New task' }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  it('submits the rich-text description from the shared editor', async () => {
    vi.spyOn(tasksApi, 'createTask').mockResolvedValueOnce({ id: 11, title: 'Rich task', status: 'todo' });

    render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rich task' } });
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: '<p>Hi <strong>there</strong></p>' },
    });

    await act(async () => {
      screen.getByText('Guardar').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(tasksApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ description: '<p>Hi <strong>there</strong></p>' })
    );
  });

  it('shows the API error and keeps the dialog open when creation fails', async () => {
    vi.spyOn(tasksApi, 'createTask').mockRejectedValueOnce({
      response: { data: { error: 'Invalid description' } },
    });
    const onCreated = vi.fn();

    render(<TaskFormModal projectId={1} users={[]} onCreated={onCreated} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Bad task' } });

    await act(async () => {
      screen.getByText('Guardar').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(await screen.findByText('Invalid description')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
    expect(screen.queryByText('¿Crear Bad task?')).not.toBeInTheDocument();
  });

  it('disables Crear while the POST is in flight so a second click does not duplicate', async () => {
    let resolveCreate;
    vi.spyOn(tasksApi, 'createTask').mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'New task' } });
    await act(async () => {
      screen.getByText('Guardar').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
    expect(screen.getByText('Guardar')).toBeDisabled();

    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });
    expect(tasksApi.createTask).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({ id: 10, title: 'New task' });
    });
  });

  it('opens a wide dialog so the editor can be used', async () => {
    render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass('sm:max-w-4xl');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd front && npm test -- src/components/kanban/TaskFormModal.test.jsx
```

Expected: FAIL (`¿Crear New task?` missing; `createTask` still called from **Guardar**).

- [ ] **Step 3: Implement confirm-then-POST**

Replace `front/src/components/kanban/TaskFormModal.jsx` with:

```jsx
import { useState } from 'react';
import * as tasksApi from '../../api/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TaskDescriptionEditor from '../tasks/TaskDescriptionEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function TaskFormModal({ projectId, users, onCreated }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setConfirmOpen(true);
  }

  async function handleCreate() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const created = await tasksApi.createTask({
        projectId,
        title,
        description,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
      onCreated(created);
      setConfirmOpen(false);
      setOpen(false);
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setDueDate('');
    } catch (err) {
      setConfirmOpen(false);
      setError(err.response?.data?.error || err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button>Nueva tarea</Button>} />
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>Descripción</Label>
              <TaskDescriptionEditor value={description} onChange={setDescription} />
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
            <Button type="submit" disabled={pending}>Guardar</Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear</DialogTitle>
          </DialogHeader>
          <p>¿Crear {title}?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={handleCreate}>
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Native `required` on **Título** still blocks submit, so confirm does not open with an empty title. Do not add an idempotency key.

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```bash
cd front && npm test -- src/components/kanban/TaskFormModal.test.jsx
cd back && npm test -- tests/routes/tasks.test.js
```

Expected: PASS both.

Then run the front suite for the files this feature touched:

```bash
cd front && npm test -- src/components/tasks/TaskDetailView.test.jsx src/pages/TaskDetailPage.test.jsx src/pages/KanbanPage.test.jsx src/components/kanban/TaskFormModal.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/components/kanban/TaskFormModal.jsx front/src/components/kanban/TaskFormModal.test.jsx
git commit -m "$(cat <<'EOF'
feat: confirm before creating a task so Guardar cannot double-post

EOF
)"
```
