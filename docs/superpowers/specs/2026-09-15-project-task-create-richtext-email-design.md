# Create tasks from a project, rich text, assignment email — Design Spec

**Date:** 2026-09-15
**Status:** Draft (pending user review)

## Purpose

The admin (vendedor) creates and assigns tasks **from the project page**, without opening Kanban. Task content supports a small rich-text set (bold, italic, underline, headings, highlight, lists, links). When a task is assigned to a user — on create or later — that user receives an email.

Kanban columns, membership, finance, features, and notes stay unchanged.

## Access rules

Roles stay `admin` | `developer`.

- **Admin:** On `/projects/:id`, sees a **Tareas** card: list of that project's tasks (title, assignee name, column name) and **Nueva tarea**. Can assign only **project members**. Same create/update APIs as today otherwise.
- **Developer member:** Does **not** see **Nueva tarea** on the project page. Can still create from Kanban if they are a member (`POST /tasks` unchanged by role). Cannot set `assigneeId` to a non-member.
- **Developer non-member:** 403 on create for that project (unchanged).

## Data model

No new tables. `Task.description` remains `TEXT`, nullable. It stores **sanitized HTML**, not plain text. Missing description, empty string, or HTML that is empty after sanitize (e.g. `<p></p>`) is stored as `null`.

No new `TaskActivity` type. Assignment is notified by email only.

`assigneeId`, when present, must reference a **ProjectMember** of `task.projectId` for **every** actor, including admin. `null` remains allowed (unassigned).

## Rich text

One editor (TipTap) in:

- Project **Nueva tarea** modal
- Kanban **Nueva tarea** modal (`TaskFormModal`)
- Task detail description (view + edit, same permission as today's description PUT)

Toolbar only: bold, italic, underline, heading (h1–h3), highlight (`<mark>`), bullet/ordered lists, links. No images, tables, or font color picker.

**Allowlist** (server sanitizes on create/update; client sanitizes on render):

`p`, `br`, `strong`, `b`, `em`, `i`, `u`, `h1`, `h2`, `h3`, `ul`, `ol`, `li`, `mark`, `a` (`href` must be `http`, `https`, or `mailto`). Strip everything else (scripts, styles, event handlers).

Kanban **cards** still show **title only**.

Max stored description length: 20_000 characters after sanitize. Over that → `400 { error: 'Invalid description' }`.

## Backend

Error body `{ error: string }`. New exact string: `Invalid assignee`, `Invalid description`. Existing strings unchanged.

### `POST /tasks`

Unchanged access (admin any project; developer must be member). Unchanged default: omitted `columnId` → first column.

If `assigneeId` is set and that user is not a member of `projectId` → `400 { error: 'Invalid assignee' }` (admins included).

Sanitize `description` before save.

After commit, if `assigneeId` is set, **fire-and-forget** assignment email (see Email). SMTP failure must **not** change the `201` response.

### `PUT /tasks/:id`

If the payload includes `assigneeId` and it is not `null` and not a member of the task's project → `400 { error: 'Invalid assignee' }`.

Sanitize `description` when present.

If `assigneeId` **changes to a different non-null user**, send assignment email to the **new** assignee. Same assignee → no mail. Change to `null` → no mail to the previous assignee.

### Email

Reuse `back/src/utils/mailer.js` and existing `SMTP_*` env vars.

New helper `sendTaskAssignedEmail({ to, task, project, assigner })`:

- Subject: `Nueva tarea: {task.title}`
- Text body: project name, assigner name, task title, link `{FRONTEND_URL}/tasks/{id}`
- `FRONTEND_URL` env (no trailing slash). If missing, omit the link and still send the rest.

Do not send when SMTP is unset: log and return; the HTTP handler still succeeds.

## UI

Copy: **Nueva tarea** (same as Kanban). Assignee `<select>` options = `GET /projects/:id/members` only. Assignee optional.

Project card empty state: short line that there are no tasks yet. Task title in the list links to `/tasks/:id`.

Developers on the project page: no Tareas create button; they do not get this card (Kanban remains their board). Finance/features/notes layout otherwise unchanged.

Task detail: render description HTML through the sanitizer. Edit uses the same editor. Failed save keeps previous HTML and shows the API `error` string.

## Testing

- Admin sees **Nueva tarea** on the project page; developer does not.
- Create from the project appears in `GET /tasks?projectId=` and in the leftmost column.
- `assigneeId` of a non-member → `400 Invalid assignee` for admin.
- Description with `<script>` is stored without the script; allowlisted tags remain.
- Description over 20_000 chars → `400 Invalid description`.
- Create with assignee calls `sendTaskAssignedEmail` once; create without assignee does not.
- PUT that changes assignee sends to the new user; PUT with the same assignee does not.
- Mailer throw: `POST /tasks` still `201`.

## Out of scope

- New roles (no `vendedor` role)
- Assignment activity type
- Email to the previous assignee
- Images, attachments, or @mentions
- Changing Kanban column from the project create form
- Digest or unsubscribe
