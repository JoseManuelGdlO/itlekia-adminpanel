# Project members — Design Spec

**Date:** 2026-09-14
**Status:** Approved
**Slice:** 1 of the sales request (members + board access). Costs, contracts, budget, project features, and extra reminder types stay out of this file.

## Purpose

An admin can assign users to a project. Those users see that project and its full Kanban board (the canvas they were given), can create tasks assigned to any member, and can move only their own cards. Every create and column move is recorded on the task.

This replaces the current access rule: a developer only sees a project if they already have a task on it, and on Kanban they only see their own cards.

## Access rules

Roles stay `admin` | `developer`. No new roles.

- **Admin** sees every project and every task. Only admin manages membership (add/remove). Only admin deletes tasks and creates/archives projects.
- **Developer** sees a project only if they have a `project_members` row. On that project they see **all** tasks. They may create tasks on that project. They may assign a new task to any **member** of that project, or leave it unassigned. They may change description and status **only** on tasks where `assigneeId` is themselves.
- Removing a member does **not** delete their tasks. It only removes board/project access. Admin still sees those tasks.
- A developer who is assigned on a task but is **not** a member does **not** see the project or the board.
- `GET /users` stays admin-only. Developers learn teammate names from `GET /projects/:id/members`.

## Data model

### ProjectMember

Join table. One row = one user is a member of one project.

- id
- projectId (FK → Project, required)
- userId (FK → User, required)
- createdAt

Unique index on `(projectId, userId)`.

Associations: `Project.belongsToMany(User, { through: ProjectMember, as: 'members' })` and the inverse `as: 'memberProjects'`.

Any existing user (admin or developer) may be added as a member. Admin does not need membership to see or edit a project.

### TaskActivity

Append-only log. No updates or deletes from the API.

- id
- taskId (FK → Task, required)
- userId (FK → User, required) — actor
- type (`created` | `status_changed`)
- fromStatus (`todo` | `in_progress` | `review` | `done`, nullable) — null on `created`
- toStatus (`todo` | `in_progress` | `review` | `done`, nullable) — `todo` on `created`; the new column on `status_changed`
- createdAt

Written in the same request that creates the task or patches status. If the activity insert fails, the whole request fails (transaction).

Existing tasks get no backfilled history. The first event appears on the next create or move.

## Backfill

After `sequelize.sync()`, run a one-shot `backfillProjectMembers()`:

If `ProjectMember.count()` is greater than zero, skip the backfill. Otherwise, for each distinct `(projectId, assigneeId)` on `Task` where `assigneeId` is not null, `findOrCreate` a `ProjectMember`.

That populates an empty membership table on first deploy without re-granting deliberately removed members on later boots. After that, membership is the only source of access; new assignees are **not** auto-added as members.

## Backend endpoints

Error body shape stays `{ error: string }` (`Project not found`, `Forbidden`, `Already a member`, `User not found`, `Invalid status`).

### Members (mounted under `/projects`)

- `GET /projects/:id/members` — admin, or developer who is a member of `:id`. Response: `[{ id, name, email, role }]`. No `passwordHash`. 404 if project missing. 403 if developer is not a member.
- `POST /projects/:id/members` — admin only. Body `{ userId }`. 201 `{ id, name, email, role }` of the added user. 404 if project or user missing. 409 if already a member. 403 for developer.
- `DELETE /projects/:id/members/:userId` — admin only. 204. 404 if project missing or that user is not a member. Does not change tasks.

### Projects (behavior change)

- `GET /projects` — admin: all, as today. Developer: projects they belong to via `ProjectMember`, ordered by `id ASC`. No longer inferred from assigned tasks.

`POST` / `PUT` / `DELETE` `/projects` stay admin-only.

### Tasks (behavior change)

- `GET /tasks` — admin: unchanged (optional `projectId`, `assigneeId`). Developer: all tasks whose `projectId` is a project they belong to. Optional `projectId` query: if they are a member, return that project's tasks; if not, 403. Do **not** force `assigneeId = req.user.id` anymore.
- `POST /tasks` — authenticated, not admin-only.
  - Admin: any existing `projectId`; `assigneeId` may be any existing user or null (same as today).
  - Developer: must be a member of `projectId` (403 otherwise). `assigneeId` must be null or a member of that project (400 otherwise).
  - On success, insert `TaskActivity` `{ type: 'created', toStatus: task.status }`.
- `PUT /tasks/:id` — unchanged: admin all fields; developer assignee may only persist `description`. Developer who is a member but not the assignee still gets 403.
- `PATCH /tasks/:id/status` — unchanged who may call it (admin or assignee). On success, insert `TaskActivity` `{ type: 'status_changed', fromStatus, toStatus }`. Do not write an activity if status did not change.
- `DELETE /tasks/:id` — admin only, as today.
- `GET /tasks/:id/activities` — admin, or developer member of the task's project. Response newest last (chronological): `[{ id, type, fromStatus, toStatus, createdAt, user: { id, name } }]`. 404 if task missing. 403 if developer is not a member of that project.

## Frontend

### Project detail (`/projects/:id`)

New **Miembros** card.

- Admin: `<select>` of users from `GET /users` excluding current members, button **Agregar**, list of name + email with **Quitar** per row.
- Developer member: read-only list of names.
- Empty copy: `Sin miembros`.
- If the project is not in `GET /projects`, keep `No se encontró`.

### Kanban (`/kanban`)

- Project `<select>` is visible to **admin and developer**. Options = `GET /projects`. Board tasks are filtered to `task.projectId === selectedProjectId`. If the user has no projects, show the empty board without the create button.
- **Nueva tarea** is visible whenever a project is selected (admin or member). Assignee options = that project's members plus `Sin asignar`. Same dropdown for admin: to assign someone who is not on the list, add them as a member first. The admin API may still accept any `assigneeId`; the UI does not offer it.
- Developer: only cards they own are draggable (`assigneeId === current user`). Other cards stay visible. Failed status PATCH still reloads the list (existing catch).
- Admin: all cards on the selected project are draggable, as today.

### Task detail (`/tasks/:id`)

New **Historial** card under the existing notes card. Lines like:

- `{name} creó la tarea`
- `{name} movió {fromLabel} → {toLabel}`

Use the same column labels as Kanban (`To Do`, `In Progress`, `Review`, `Done`). Empty copy: `Sin actividad`.

Because `GET /tasks` now returns a member's full project board, opening a teammate's task detail works. Notes on that page stay owner-scoped (unchanged): a developer still only sees **their** notes on that task.

## Error handling

| Case | Status |
| --- | --- |
| Not logged in | 401 |
| Developer mutates members | 403 |
| Developer lists or creates on a project they do not belong to | 403 |
| Developer PATCHes a task they do not own | 403 |
| Developer assigns a non-member on create | 400 |
| Missing project or user | 404 |
| Duplicate member | 409 |
| Invalid task status | 400 |
| Activity write fails | 500, task create/status not committed |

## Testing

Backend (supertest, same style as `back/tests/routes/projects.test.js` and `tasks.test.js`):

- Developer without membership does not see a project even if they have a task there.
- Developer with membership sees the project and all of its tasks.
- Developer member can POST a task assigned to another member; cannot POST to a foreign project; cannot assign a non-member.
- Admin add/remove members; 409 on duplicate; developer 403 on POST/DELETE members.
- Developer GET members on a project they belong to; 403 otherwise.
- PATCH status by assignee writes `status_changed`; create writes `created`; GET activities 403 for a non-member.
- Backfill creates members from existing assignees and is idempotent.

Frontend (vitest):

- Project detail: admin sees add/remove; developer does not see those controls; list still renders.
- Kanban: developer sees the project select and **Nueva tarea**; tasks from another project are not shown when one project is selected.
- Task detail: renders activity lines from the API mock.

Keep existing visible strings that tests already lock (`To Do`, `In Progress`, `Review`, `Done`, `Nueva tarea`, `Sin asignar`, `No se encontró`). New copy above is the source of truth for new assertions.

## Out of scope

- File uploads, costs, contracts, budget amounts
- Project-level features, extra note types, in-app reminder alerts beyond existing note emails
- Activity types other than `created` and `status_changed` (no title/description/assignee log)
- Auto-adding a user as member when they are assigned to a task after backfill
- Members managing other members
- Developer deleting tasks or creating projects
- Recurring reminders, client role, GET `/tasks/:id` resource (detail still uses list + find)

## Success criteria

1. Admin assigns a developer on a project that has no tasks yet; that developer sees the project and an empty board.
2. Two members on the same project both see both people's cards; each can drag only their own.
3. A member creates a task for a teammate; the teammate can move it; historial shows create then the move.
4. After a member is removed, they no longer see the project or its board; their old tasks remain for admin.
