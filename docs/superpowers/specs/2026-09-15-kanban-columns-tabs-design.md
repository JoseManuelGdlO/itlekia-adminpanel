# Kanban columns and project tabs — Design Spec

**Date:** 2026-09-15
**Status:** Draft (pending user review)

## Purpose

The admin defines the Kanban columns **per project**: add, rename, reorder, and delete (only when empty). New projects start with the current four columns. New tasks land in the leftmost column. The project picker on the board is a **tab row**, not a dropdown. Developers see the columns and can still move only their own cards; they cannot edit columns.

Membership, finance, features, and notes stay unchanged.

## Access rules

Roles stay `admin` | `developer`.

- **Admin:** CRUD and reorder columns on any project. Sees every project tab. Same task drag rules as today (any card).
- **Developer member:** `GET` columns for that project. Sees that project as a tab. Cannot create, rename, reorder, or delete columns (403). Can drag only their assigned cards onto existing columns of **that** project.
- **Developer non-member:** 403 on that project's columns (same as they already cannot see the project).

## Data model

### BoardColumn

One row = one column on one project's board.

- id
- projectId (FK → Project, required)
- name (string, required) — unique per project (case-sensitive)
- position (integer, required) — 0-based left-to-right order
- createdAt
- updatedAt

Associations: `Project.hasMany(BoardColumn, { foreignKey: 'projectId', as: 'boardColumns' })`, `BoardColumn.belongsTo(Project, { as: 'project' })`. Ordered by `position ASC`, then `id ASC`.

Default seed (on `POST /projects` and on backfill), in this order, `position` 0..3:

1. `To Do`
2. `In Progress`
3. `Review`
4. `Done`

### Task (change)

Remove `status` ENUM `todo | in_progress | review | done`.

Add:

- columnId (FK → BoardColumn, required)

`ON DELETE RESTRICT` so a column with tasks cannot be deleted. The column's `projectId` must match `task.projectId`.

Create without `columnId`: server sets it to the project's column with the lowest `position`. Explicit `columnId` is allowed only if it belongs to the same project.

### TaskActivity (change)

`fromStatus` and `toStatus` become **STRING**, nullable (no ENUM). They store the **column name at the time of the event**. Rename does not rewrite history. `type` stays `created | status_changed`.

- `created`: `fromStatus` null, `toStatus` = name of the column the task was created in
- `status_changed`: names of the previous and new columns

## Backfill

One-shot helper after `sequelize.sync()`, skip if `BoardColumn.count() > 0`:

1. For each project, create the four default columns if it has none.
2. For each task with a legacy `status` (or null `columnId`), set `columnId` from that map: `todo` → `To Do`, `in_progress` → `In Progress`, `review` → `Review`, `done` → `Done`. Unknown/missing status → `To Do`.
3. Map existing activity slugs with the same four labels so old events stay readable.

After backfill, `Task.status` is gone. New tasks never write a status slug.

## Backend endpoints

Error body `{ error: string }`. Exact strings:

`Project not found`, `Forbidden`, `Column not found`, `Invalid name`, `Column not empty`, `Invalid order`, `Invalid column`, `Task not found`.

Column moves return `Invalid column`, not a status-slug error.

### Columns (mounted under `/projects`, before `PUT /:id`)

- `GET /projects/:id/columns` — admin, or developer member. `[{ id, projectId, name, position }]`, `position ASC`. 404 project missing. 403 developer non-member.
- `POST /projects/:id/columns` — admin. Body `{ name }`. Trimmed name; empty → 400 `Invalid name`; duplicate on that project → 400 `Invalid name`. Appends at `max(position)+1` (or 0 if none). 201 the column. 403 developer.
- `PUT /projects/:id/columns/:columnId` — admin. Body `{ name }` to rename (same name rules). 200 the column. 404 `Column not found` if missing or wrong project.
- `PUT /projects/:id/columns/reorder` — admin. Body `{ columnIds: number[] }` must be a permutation of **all** column ids for that project. Rewrite `position` to the array index. 200 the full ordered list. Incomplete, duplicate, or foreign ids → 400 `Invalid order`.
- `DELETE /projects/:id/columns/:columnId` — admin. 204 if no tasks. 409 `{ error: 'Column not empty' }` if any task has that `columnId`. 404 if missing or wrong project. Does not shift remaining positions (gaps are fine; list still sorts by `position`).

Route order: mount `/columns/reorder` **before** `/columns/:columnId`.

### Tasks (behavior change)

- `POST /tasks` — unchanged access. Persist `columnId` as above. Activity `toStatus` is that column's **name**.
- `PATCH /tasks/:id/column` — replaces `PATCH /tasks/:id/status`. Body `{ columnId }`. Same actor rules as today's status patch (admin, or assignee). Column must belong to `task.projectId` else 400 `Invalid column`. Same-column is 200 no-op (no extra activity). On change: write `status_changed` with previous and new **names**, in a transaction. 403 / 404 unchanged.
- Remove `PATCH /tasks/:id/status`.

`GET /tasks` includes `columnId`. Column names and order come from `GET /projects/:id/columns`. Clients must not send or display `status` slugs.

## UI

Page: `KanbanPage`. No project `<select>` / combobox.

- **Tabs:** one tab per project from `listProjects()`, label = `project.name`. Active tab sets the selected project (default: first project). Horizontal scroll if they overflow. Switching tab reloads columns, tasks, and members for that project (same stale-response guard as today's member fetch).
- **Nueva tarea:** stays to the right of the tab row, bound to the active project.
- **Columns:** render `GET .../columns` left to right. Cards group by `columnId`. Droppable id is the column id (string/number consistent with dnd-kit).
- **Admin column chrome:** click the header name to edit; Enter or blur saves `PUT` rename. × visible only when that column's task count is 0; click deletes immediately (no confirm — it is already empty). A **drag handle on the header** reorders columns so card drag is unchanged; on drop `PUT .../reorder` with the new id list. Ghost column on the right: **+ Columna** reveals an inline name field; submit `POST`s and clears the field.
- **Developer:** same tabs, columns, and cards. No rename, ×, header drag, or + Columna.
- Task cards keep linking to `/tasks/:id`. Status dots: cycle a small palette by `position` (no hard-coded `todo` keys).
- Task detail activity: show `fromStatus` / `toStatus` as stored strings (column names or backfilled labels). Drop the slug→label map.

Empty project list: no tabs, no board, no + Columna (nothing to attach columns to). Project with zero columns (should not happen after seed): admin sees only + Columna.

Failed rename/add: keep previous name, show the API `error` string. Failed delete (409): column stays.

## Testing

Backend:

- `POST /projects` creates the four default columns in order.
- Backfill maps legacy statuses onto those columns.
- Admin column CRUD + reorder; developer GET allowed, writes 403.
- Delete with tasks → 409 `Column not empty`; empty/duplicate name → 400 `Invalid name`.
- Create task without `columnId` uses the leftmost column; `PATCH .../column` moves and logs names.

Frontend:

- Kanban shows project names as tabs, not a combobox.
- Clicking a tab shows only that project's cards.
- Admin sees + Columna and can rename; developer does not.
- Columns render in `position` order.

## Out of scope

- Global (cross-project) columns
- Marking a default column other than leftmost
- Choosing a column in the create-task form
- Deleting a column by moving or deleting its tasks
- WIP limits, column colors, or per-column permissions
- Changing finance, features, notes, or membership
