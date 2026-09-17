# Operational dashboard home — Design Spec

**Date:** 2026-09-17
**Status:** Draft (pending user review)

## Purpose

Replace the Dashboard tile menu with a real **home of work**. On login, admin and developer see the same layout: four counts, then one list of things that are overdue, due today, or a paused project.

Kanban, project statuses, notes, features, finance, membership, and reminder email stay unchanged. This spec only adds a read model and a new Dashboard page body.

## Roles

Roles stay `admin` | `developer`. Same layout. The role only changes **which rows** `GET /dashboard` includes.

| | Developer | Admin |
|---|---|---|
| Tasks | `assigneeId = me`, due overdue or today | Same rules, **all** assignees (including unassigned) |
| Note reminders | Owner **or** in `notifyUsers` | Same, all matching notes |
| Feature reminders | Creator (`Feature.userId`) **or** in `notifyUsers` | Same, all matching features |
| Paused projects | Member + `status = parado` | All `parado` |

## Day window

Timezone is **`America/Mexico_City`**. No other zones in v1.

For a datetime `d`, the **calendar date** is `YYYY-MM-DD` of `d` in that timezone (via `Intl`, no extra date library).

**Today** = calendar date of `now` in that timezone.

| Bucket | Tasks (`dueDate`) | Reminders (`remindAt`, and `isReminder = true`) |
|---|---|---|
| `overdue` | calendar date **before** today | calendar date **before** today **and** `notifiedAt` is `null` |
| `today` | calendar date **equals** today | calendar date **equals** today (even if already emailed) |
| excluded | no `dueDate`; calendar date **after** today | not a reminder; no `remindAt`; calendar date after today; **or** overdue and already `notifiedAt` set |

Paused projects ignore the window: they always appear when the status is `parado` and the viewer is allowed to see that project.

## What is excluded

- Tasks with no `dueDate`.
- Tasks whose `columnId` is the project's **rightmost** column: `BoardColumn` with the greatest `position` for that `projectId` (tie: greatest `id`). On default boards that column is **Done**.
- Tasks, note reminders, and feature reminders whose project is `oculto` or `archivado`. A note linked only to a task uses that task's `projectId` (and `projectName`). Standalone notes (no project, no task) are not hidden by project status.
- Feature `status` (`pending` / `done`) does **not** affect inclusion.
- A paused **row** is never emitted for `oculto` / `archivado` (those statuses are not `parado`).

A task on a **paused** project still appears as a task row if it passes the date/column filters. The project **also** appears as a `project` row. That duplication is intended.

## API

`GET /dashboard` — `requireAuth` only (both roles). No query params. No writes.

Mount in `app.js` as `app.use('/dashboard', dashboardRoutes)`.

Error body `{ error: string }`. **No new error strings.** Unauthenticated → existing `401` (`Not authenticated` / `Invalid or expired token`). Unexpected failure → existing `500 { error: 'Internal server error' }`. Empty home → `200` with zeros and `items: []` (not an error). Developers never get `403` here: they simply omit rows they must not see.

### Response

```json
{
  "pulse": {
    "overdue": 0,
    "today": 0,
    "remindersToday": 0,
    "paused": 0
  },
  "items": []
}
```

`pulse` is counted from the **same** `items` array (no second query that can drift):

- `overdue` — items with `kind = "task"` and `bucket = "overdue"`
- `today` — items with `kind = "task"` and `bucket = "today"`
- `remindersToday` — items with `kind` `note_reminder` or `feature_reminder`
- `paused` — items with `kind = "project"`

### Item shape

Every item has exactly these fields:

| Field | Type | Notes |
|---|---|---|
| `kind` | string | `task` \| `note_reminder` \| `feature_reminder` \| `project` |
| `id` | number | Id of that resource (`Task.id`, `Note.id`, `Feature.id`, or `Project.id`) |
| `title` | string | `Task.title` / `Note.title` / `Feature.title` / `Project.name` |
| `at` | string \| null | ISO-8601 (`toISOString()`) of `dueDate` or `remindAt`. Always `null` for `project` |
| `bucket` | string | `overdue` \| `today` \| `paused`. Reminders use `overdue` or `today`; they still count only in `pulse.remindersToday`, never in `pulse.overdue` / `pulse.today`. |
| `projectId` | number \| null | For `project`, equals `id`. `null` only for a standalone note reminder |
| `projectName` | string \| null | For `project`, equals `title`. `null` only for a standalone note reminder |
| `taskId` | number \| null | Set only for `note_reminder` linked to a task; otherwise `null` |

Do not send descriptions, HTML, assignees, or notify user lists.

### Item order (stable)

Sort by this tuple, all ascending:

1. group: `0` = task overdue, `1` = task today, `2` = reminder, `3` = paused project
2. `at` (projects use empty string so name/id decide)
3. kind: `note_reminder` before `feature_reminder` (other kinds ignore this)
4. `projectName` with `localeCompare('es')` (only group `3`; others ignore)
5. `id`

## UI

Route `/` stays Dashboard. AppShell title stays **Dashboard**. Greeting stays `Hola, {name}`.

**Remove** the four navigation tiles (including the admin-only Usuarios tile). The rail already links those pages.

Subtitle (both roles, exact): `Vencidas y para hoy, más proyectos parados.`

### Pulse

Four cards in the existing responsive grid. Number + label only. **Clicks do not filter.**

| Label | Field |
|---|---|
| Vencidas | `pulse.overdue` |
| Hoy | `pulse.today` |
| Recordatorios | `pulse.remindersToday` |
| Parados | `pulse.paused` |

### List

One `Card` with `divide-y`, same pattern as the projects list.

Each row:

- Title is a `Link` (`text-primary`, underline on hover).
- Second line for `task` / reminders: **type label** · project name (omit `· {project}` when `projectName` is null) · date.
- Type labels exact: `Tarea`, `Recordatorio`, `Feature`, `Parado`.
- Date: `new Date(at).toLocaleDateString('es-MX')`. If `bucket === "overdue"`, the date uses `text-destructive`.
- `kind = project` second line: type `Parado` plus existing `StatusPill` (`status="parado"`). Do not repeat the project name. No date.

Href (front helper, not sent by the API):

| kind | path |
|---|---|
| `task` | `/tasks/:id` |
| `note_reminder` with `taskId` | `/tasks/:taskId` |
| `note_reminder` with `projectId` and no `taskId` | `/projects/:projectId` |
| `note_reminder` with no project and no task | `/notes` |
| `feature_reminder` | `/projects/:projectId` |
| `project` | `/projects/:id` |

### Page states

- Loading: existing `PageSkeleton`.
- Request failure: `No se pudo cargar` (`text-destructive`).
- Success with empty `items` (pulse all zeros): existing `EmptyState` with `Nada vencido ni para hoy`.

On mount, one `GET /dashboard` via `front/src/api/dashboard.js` (`withCredentials` client). No polling.

401 is handled by existing auth (cookie). Do not add dashboard-specific login UI.

## Files

**Create**

- `back/src/utils/dashboardWindow.js` — timezone constant, calendar date, task/reminder bucket, rightmost column id per project
- `back/src/controllers/dashboardController.js` — assemble `pulse` + `items`
- `back/src/routes/dashboard.js` — `GET /` + `requireAuth`
- `back/tests/routes/dashboard.test.js`
- `back/tests/utils/dashboardWindow.test.js`
- `front/src/api/dashboard.js` — `getDashboard()`
- `front/src/lib/dashboardItemHref.js` — href table above
- `front/src/lib/dashboardItemHref.test.js`

**Modify**

- `back/src/app.js` — mount `/dashboard`
- `front/src/pages/DashboardPage.jsx` — pulse + list; delete tiles
- `front/src/pages/DashboardPage.test.jsx` — greet + four labels + empty/error; **no** Kanban/Usuarios tiles

Do not change Kanban, notes CRUD, feature CRUD, finance, or project status write paths.

## Tests

TDD. Freeze `now` so calendar dates in `America/Mexico_City` are deterministic (e.g. `2026-09-17T18:00:00.000Z` = noon in CDMX, UTC−6).

**Window helper:** today vs overdue vs excluded; reminder overdue requires `notifiedAt = null`; already-notified overdue reminder excluded; today reminder included even with `notifiedAt`.

**Route:** 401 without cookie. Developer omits other people's tasks, omits reminders they neither own nor were added to, omits `parado` projects they are not a member of. Admin sees team-wide. Unassigned dated task appears for admin, not for developer. Task in rightmost column omitted. Task/reminder on `archivado` omitted. Standalone note reminder still listed. Paused project listed with `bucket: "paused"` and `at: null`. Empty payload shape as above.

**Front:** four labels and numbers; row type copy; overdue date styling; empty copy; error copy; skeleton while pending; tiles gone for both roles.

## Out of scope

Click-to-filter pulse cards, polling, in-app notifications, tasks without `dueDate` in the list, other timezones, pagination, a “sin asignar” pulse count, changing reminder email, client portal.
