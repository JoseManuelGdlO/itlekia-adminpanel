# Team stats and estimated hours — Design Spec

**Date:** 2026-09-17
**Status:** Approved

## Purpose

Admins get an **Equipo** page: one row per user with project membership count, task counts by Kanban bucket, and summed estimated hours on open work.

Each task can store optional **estimated hours**. Only admins see or edit that field. Kanban, Dashboard, notes, finance, features, and project statuses stay unchanged except for this field on tasks and the new page.

## Roles

Roles stay `admin` | `developer`.

- **Equipo / `GET /stats/team`:** admin only. Developer never sees the nav item. `403 { error: 'Forbidden' }`.
- **`estimatedHours`:** admin only to read and write. Developer responses omit the field. A developer `PUT`/`POST` that includes `estimatedHours` is accepted but **the value is ignored** (existing hours stay; new tasks stay `null`).

## Estimated hours on a task

New nullable column `Task.estimatedHours` (`DECIMAL`, `null` = not estimated).

- Allowed: `null`, or a finite number **≥ 0**. Decimals allowed (`2.5`).
- Empty input in the UI sends `null`.
- Invalid (negative, `NaN`, non-numeric string, object): `400 { error: 'Invalid estimated hours' }`.
- Admin create/update may set it. Not required.
- No display on the Kanban card.
- Admin UI label: `Tiempo estimado (h)` on **Nueva tarea** (`TaskFormModal`) and task **detalle** (`TaskDetailView`). On detail, changing the input saves immediately via existing `PUT /tasks/:id` (same pattern as **Asignar a**). Create still goes through Guardar → Crear; the admin POST payload includes `estimatedHours` (`null` if empty).

Strip the field in every task JSON the developer receives (`list`, `create` 201, `update`). Admin JSON includes it (`null` when unset).

## Column buckets

Same position rule as Dashboard’s rightmost column: greatest `position`, tie → greatest `id`. Leftmost is the opposite (least `position`, tie → least `id`).

For a task on a project:

| Bucket | JSON field | Rule |
|---|---|---|
| Por hacer | `todo` | `columnId` is the project’s **leftmost** column, and that column is **not** also the rightmost |
| En curso | `inProgress` | not leftmost and not rightmost |
| Hechas | `done` | `columnId` is the project’s **rightmost** column |

One-column board: that column is rightmost → every task is `done` (`todo` and `inProgress` stay 0). Two-column board: first = `todo`, last = `done`, `inProgress` = 0.

## Team stats

`GET /stats/team` — `requireAuth` + `requireRole('admin')`. No query params. No writes.

Mount: `app.use('/stats', statsRoutes)` with `GET /team`.

**Included projects:** `status` is `trabajando` or `parado` (`isKanbanListed`). `oculto` and `archivado` never count for membership or tasks.

**Who appears:** every user (`admin` and `developer`), even with zero projects and zero tasks. Sort by `name` ASC, then `id` ASC.

**Per user:**

- `projects` — count of those listed projects where the user is a **member**.
- `todo` / `inProgress` / `done` — count of tasks with `assigneeId` = that user, on a listed project, in that bucket. Unassigned tasks are not counted for anyone.
- `estimatedHours` — **sum** of `Task.estimatedHours` for that user’s tasks in **`todo` and `inProgress` only** (not `done`). Treat `null` as 0. Return a number (0 if none).

Unauthenticated → existing `401`. Unexpected failure → existing `500 { error: 'Internal server error' }`. No members at all → `200 { "members": [] }` (not an error).

### Response

```json
{
  "members": [
    {
      "id": 1,
      "name": "Ada",
      "role": "admin",
      "projects": 2,
      "todo": 1,
      "inProgress": 3,
      "done": 4,
      "estimatedHours": 6.5
    }
  ]
}
```

Exact keys: `id`, `name`, `role`, `projects`, `todo`, `inProgress`, `done`, `estimatedHours`. No extra fields.

## Equipo UI

Nav item **Equipo** (admin only), path `/team`, between **Proyectos** and **Usuarios**. `AuthenticatedLayout role="admin"`.

Page title **Equipo**. Table headers: `Nombre`, `Proyectos`, `Por hacer`, `En curso`, `Hechas`, `Horas est.` Empty `members` → `Nadie en el equipo`. Load error → existing style `No se pudo cargar` (same as Dashboard).

Hours in the table: the number from the API (no unit suffix in the cell; the column header is `Horas est.`).

## Files

**Create**

- `back/src/utils/taskBuckets.js` — leftmost/rightmost ids, `columnBucket(columnId, columns)` → `'todo' | 'inProgress' | 'done'`
- `back/src/controllers/statsController.js`
- `back/src/routes/stats.js`
- `front/src/api/stats.js` — `getTeamStats()`
- `front/src/pages/TeamPage.jsx`
- `front/src/pages/TeamPage.test.jsx`

**Modify**

- `back/src/models/task.js` — `estimatedHours`
- `back/src/controllers/tasksController.js` — parse/strip hours
- `back/src/app.js` — mount `/stats`
- `front/src/App.jsx` — `/team`
- `front/src/components/AppShell.jsx` — nav
- `front/src/components/kanban/TaskFormModal.jsx` — admin hours field + POST
- `front/src/components/tasks/TaskDetailView.jsx` — admin hours field + PUT
- Existing task tests for hours omit/ignore; new `back/tests/routes/stats.test.js`

Do not change notes, finance, Dashboard pulse rules, or Kanban card layout.

## Tests

TDD.

**Buckets (unit):** one-column → `done`; two-column → `todo`/`done`; three+ → middle is `inProgress`; position tie broken by id.

**Stats:** Admin gets both an admin and a developer row. Developer `GET /stats/team` → `403 { error: 'Forbidden' }`. Membership on `parado` counts; `archivado` does not. Assigned task on `oculto` does not increment buckets. Unassigned task does not increment anyone. Hours: `2.5` on a `todo` task plus `null` on `inProgress` plus `10` on `done` → `estimatedHours` is `2.5`. Empty users table → `members: []`.

**Hours on tasks:** Admin `POST`/`PUT`/`GET` include `estimatedHours`. Developer list/create/update JSON has no `estimatedHours` key. Developer `PUT { estimatedHours: 99 }` leaves the stored value unchanged. Negative → `400 { error: 'Invalid estimated hours' }`.

**Front:** Admin sees **Equipo** and the table copy. Developer does not see the link. Admin sees `Tiempo estimado (h)` on create and detail; developer does not. Create confirm still POSTs once; admin payload contains `estimatedHours`.

## Out of scope

Hours on the Kanban card, developer self-stats, time tracking / spent hours, CSV export, filtering the Equipo table, changing who may `POST /tasks`.
