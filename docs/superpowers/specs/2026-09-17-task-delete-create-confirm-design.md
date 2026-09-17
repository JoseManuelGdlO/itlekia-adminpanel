# Task delete UI and create confirmation — Design Spec

**Date:** 2026-09-17
**Status:** Draft (pending user review)

## Purpose

Admins can **delete a task** from its detail view, with the same confirm-dialog pattern as project delete. Creating a task requires a **second confirm** so a double click on **Guardar** does not POST twice.

Notes stay as they are: owner-only **Eliminar**, one click, no extra dialog.

Kanban drag, columns, paused-project create/move guards, finance, features, and reminder email stay unchanged except where this spec says a deleted task also removes its notes and activity rows.

## Roles

Roles stay `admin` | `developer`.

- **Delete task:** only **admin**. Front shows **Eliminar** when `user.role === 'admin'` (same check as assignee editing). Developer never sees the button. `DELETE /tasks/:id` stays `requireRole('admin')` (`403 { error: 'Forbidden' }` for others).
- **Create task:** whoever can open **Nueva tarea** today (existing rules, including paused boards hiding/blocking create). The extra confirm does not change who may create.
- **Notes:** owner may delete; non-owner still `403 { error: 'Forbidden' }`. No UI change.

## Delete task

### API

`DELETE /tasks/:id` — admin only. No new routes. No new error strings. Body `{ error: string }`.

- Unknown id → `404 { error: 'Task not found' }`
- Success → `204`
- Unauthenticated → existing `401`
- Unexpected failure → existing `500 { error: 'Internal server error' }`

Today `remove` only calls `task.destroy()`. Notes and `TaskActivity` do not cascade from that destroy (same reason project delete is manual). In **one transaction**, matching the task slice of `projectsController.remove`:

1. Load the task; if missing, `404` (no transaction needed).
2. Load notes with `taskId` = that task. If any: delete their `NoteNotify` rows, then those notes.
3. Delete `TaskActivity` rows for that `taskId`.
4. Delete the task.
5. Commit. On error: rollback and rethrow (existing 500 handler).

Notes with this `taskId` are removed even if they also have a `projectId`. Notes on the same project that are **not** linked to this task stay. Features, finance, and other tasks are untouched.

Project `parado`: admin **may** delete (paused blocks create/move, not this delete).

### UI

**Eliminar** only on the task detail: `TaskDetailView` (Kanban modal and `/tasks/:id`). Not on the Kanban card. Not on `ProjectTasksCard`.

Same control pattern as `ProjectStatusControls`:

- Trigger: **Eliminar** (`variant="destructive"`, `size="sm"`).
  - Page (`embedded === false`): in the header row next to the `h2` title.
  - Modal (`embedded === true`): at the top of `TaskDetailView` (the title already lives in `TaskDetailModal`’s `DialogTitle`). Nested dialogs already exist here (`NoteFormModal` inside the detail modal); use the same `Dialog` primitive.
- Dialog title: `Eliminar`
- Body: `¿Eliminar {título}? Se borran notas e historial de la tarea.` `{título}` is `task.title` as stored, not truncated.
- Actions: **Cancelar** / **Eliminar**

**Cancelar** (or dismiss) closes only the confirm dialog. The detail stays open.

Confirm **Eliminar** calls `deleteTask(task.id)`. On `204`:

- Call `onDeleted(task)` if provided.
- Embedded (Kanban modal): `TaskDetailModal` gets `onDeleted` and forwards it. `KanbanPage` closes the modal (`setOpenTask(null)`) and removes that task from the board list by `id`.
- Page `/tasks/:id`: `TaskDetailPage` passes `onDeleted` that `navigate('/kanban')`.

If DELETE fails: keep the confirm dialog open; show `err.response?.data?.error || err.message` in the existing `TaskDetailView` error line.

Developer: no button, no dialog, no `deleteTask` call.

## Create task confirmation

`TaskFormModal` only (Kanban **and** project `ProjectTasksCard` — both already use this component).

Confirm is a **second** `Dialog` (same primitive as project delete), not a `window.confirm`.

1. User fills the form and clicks **Guardar**. Native `required` on **Título** still applies: empty title does not open the confirm and does not POST.
2. If the form is valid, that submit **must not** call `createTask`. Open the confirm instead.
3. Confirm dialog title: `Crear`. Body: `¿Crear {título}?` `{título}` is the current form title. Actions: **Cancelar** / **Crear**.
4. **Cancelar** (or dismiss) closes only the confirm; the **Nueva tarea** form stays open with the same field values.
5. **Crear** (`type="button"`) sends the existing `POST /tasks` payload (`projectId`, `title`, `description`, `assigneeId`, `dueDate`). While that request is in flight, **Crear** and **Guardar** are `disabled`. A second click does not fire a second POST.
6. Success: existing behavior (close form, reset fields, `onCreated`). Confirm closes with the form.
7. Failure: confirm **closes**; existing error string shows on the form; user can fix and click **Guardar** again (which opens confirm again). `onCreated` is not called.

Paused project: existing `403 { error: 'Project is paused' }` on POST, shown as today.

No server idempotency key. No “same title already exists” check.

Existing `TaskFormModal.test.jsx` cases that click **Guardar** and expect `createTask` must click **Crear** after the confirm appears.

## Files

**Modify**

- `back/src/controllers/tasksController.js` — transactional cascade delete (same child order as project delete’s task slice)
- `front/src/api/tasks.js` — `deleteTask(id)` → `DELETE /tasks/:id`
- `front/src/components/tasks/TaskDetailView.jsx` — admin delete + dialog + `onDeleted`
- `front/src/components/tasks/TaskDetailModal.jsx` — pass `onDeleted` through
- `front/src/pages/KanbanPage.jsx` — close modal and remove task from list on delete
- `front/src/pages/TaskDetailPage.jsx` — `navigate('/kanban')` after delete
- `front/src/components/kanban/TaskFormModal.jsx` — confirm then POST; disable while pending
- `front/src/components/kanban/TaskFormModal.test.jsx` — Guardar no longer POSTs; success/error paths go through **Crear**

**Test (create or extend)**

- `back/tests/routes/tasks.test.js` — cascade; developer 403; unknown 404 (keep the existing admin 204 case)
- `front/src/components/tasks/TaskDetailView.test.jsx` — admin **Eliminar** + copy + `deleteTask`; developer has no button
- `front/src/pages/TaskDetailPage.test.jsx` — after 204, location is `/kanban`
- `front/src/components/kanban/TaskFormModal.test.jsx` — Guardar does not POST; Crear does; pending disables duplicate POST

Do not change notes CRUD UI, `DELETE /notes`, or `ProjectTasksCard` beyond inheriting the form confirm.

## Tests

TDD.

**Back:** Admin deletes a task that has a note (with `NoteNotify`) and a `TaskActivity`: `204`; that note, notify, activity, and task rows are gone; a sibling note on the same project without this `taskId` remains. Developer `403 { error: 'Forbidden' }` and the task remains. Unknown id `404 { error: 'Task not found' }`. Existing “admin deletes a task” 204 still passes.

**Front delete:** Admin sees **Eliminar** and the exact body `¿Eliminar Build homepage? Se borran notas e historial de la tarea.` (use that title in the fixture). Developer does not see **Eliminar**. Confirm **Eliminar** calls `deleteTask` with the task id. On `TaskDetailPage`, after `204`, the router is at `/kanban`.

**Front create:** Click **Nueva tarea**, fill title, **Guardar** → confirm visible (`¿Crear New task?`), `createTask` not called. **Crear** → `createTask` called once with the same payload as today. If `createTask` returns a hanging promise, **Crear** is disabled and a second click does not call it again. Failed POST: error text on the form, `onCreated` not called, **Título** still visible.

## Out of scope

Delete on the Kanban card or project task list, POST idempotency keys, duplicate-title warning, confirm dialog for notes, changing who may `POST /tasks`, disabling delete while the DELETE is in flight (project delete does not do that either).
