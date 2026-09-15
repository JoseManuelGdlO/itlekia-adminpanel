# Project finance and features — Design Spec

**Date:** 2026-09-14
**Status:** Draft (pending user review)
**Slice:** 2 of the sales request (costs, contracts, budget, features, feature reminders). Membership and Kanban stay as in `2026-09-14-project-members-design.md`.

## Purpose

On the project detail page, an admin records costs, contracts, and budget as annotated line items (optional file). The same page lists **features** for the project. Developers who are members never see finance. They see features read-only, plus the existing Kanban. A feature reminder emails **only the admin who created it**, using the same one-shot SMTP job as notes.

## Access rules

Roles stay `admin` | `developer`.

- **Admin:** CRUD finance items and features on any project. Download finance files. Existing project/task/member powers unchanged.
- **Developer member:** `GET` features. Cannot create, update, or delete features. Cannot `GET/POST/PUT/DELETE` finance or download files (403). Kanban and existing notes unchanged.
- **Developer non-member:** 403 on that project's features (same as they already cannot see the project).
- Notes remain owner-scoped as today. This slice does not hide notes from developers.

## Data model

### FinanceItem

One row = one cost, contract, or budget line on a project.

- id
- projectId (FK → Project, required)
- kind (`cost` | `contract` | `budget`, required)
- title (string, required)
- amount (DECIMAL(12,2), required, >= 0)
- notes (text, nullable) — free annotation, not a Note record
- fileName (string, nullable) — original upload name
- storedName (string, nullable) — name on disk
- mimeType (string, nullable)
- createdBy (FK → User, required)
- createdAt
- updatedAt

Deleting the row deletes the file on disk if present. Several items of the same kind are allowed. There is no separate “project budget total” field; the UI can sum `kind = budget` amounts for display.

### Feature

- id
- projectId (FK → Project, required)
- userId (FK → User, required) — creating admin; reminder recipient
- title (string, required)
- description (text, nullable)
- status (`pending` | `done`, required, default `pending`)
- isReminder (boolean, default false)
- remindAt (datetime, nullable) — only if isReminder
- notifiedAt (datetime, nullable) — set when the email is sent
- createdAt
- updatedAt

Reminders are one-shot, not recurring. Existing features are not backfilled.

## File storage

- Directory: `back/uploads/finance/` (gitignored). Filename on disk: `{financeItemId}-{safeOriginal}` or a uuid; `storedName` holds it.
- Allowed MIME: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Max size: 10 MB.
- Upload is optional. Replace-on-update: a new file replaces the old one; omit file to keep the current one; no “delete file only” endpoint in this slice (delete the whole item).
- No S3, no public URL. Download only through the authenticated GET.

## Backend endpoints

Error bodies stay `{ error: string }`. Reuse: `Project not found`, `Forbidden`. New: `Finance item not found`, `Feature not found`, `File not found`, `Invalid kind`, `Invalid amount`, `Invalid file type`, `File too large`.

All routes under `/projects/:id/...`. 404 if the project is missing.

### Finance (admin only — `requireRole('admin')`)

- `GET /projects/:id/finance` — all items for the project, `id ASC`. JSON omits `storedName` (internal). Includes `hasFile` boolean.
- `POST /projects/:id/finance` — `multipart/form-data`: `kind`, `title`, `amount` (string parsed to number), `notes`, optional `file`. 201 item. Invalid or negative amount → 400 `Invalid amount`.
- `PUT /projects/:id/finance/:itemId` — same fields, all optional except that `kind` if sent must be valid. 200 item. 404 if item missing or not on this project.
- `DELETE /projects/:id/finance/:itemId` — 204. Deletes disk file.
- `GET /projects/:id/finance/:itemId/file` — streams the file with `Content-Disposition: attachment; filename="{fileName}"`. 404 `File not found` if no upload.

Developer hitting any of these: 403 `Forbidden`.

### Features

- `GET /projects/:id/features` — admin, or developer who is a member of `:id`. 403 otherwise. Order `id ASC`.
- `POST /projects/:id/features` — admin. Body `{ title, description, status, isReminder, remindAt }`. Sets `userId` to `req.user.id`. 201.
- `PUT /projects/:id/features/:featureId` — admin. Same fields optional. If `isReminder` is set false, clear `remindAt` and do not clear `notifiedAt` (already sent stays sent). 200. 404 `Feature not found`.
- `DELETE /projects/:id/features/:featureId` — admin. 204.

Developer POST/PUT/DELETE: 403.

### Reminder job

`checkAndSendReminders` also loads features with `isReminder = true`, `remindAt <= now()`, `notifiedAt IS NULL`, includes creator `user`. Sends `sendReminderEmail({ to: user.email, note: { title: feature.title, content: feature.description || '' } })` (same mailer shape as notes). Then sets `notifiedAt`. Notes behavior unchanged.

## Frontend

### Project detail (`/projects/:id`)

**Finanzas** card — render only if `user.role === 'admin'`.

- Three sections with headings `Costos`, `Contratos`, `Presupuesto` (filter by `kind`).
- Each section: form (título, monto, nota, archivo) + `Agregar`. List: title, amount (as given), notes, download link `Descargar` if `hasFile`, `Quitar`.
- Empty section copy: `Sin partidas`.
- Optional line under Presupuesto: `Total {sum}` using the listed budget amounts. No extra API.

**Features** card — admin and member (anyone who can open the project).

- Title `Features`. Empty `Sin features`.
- Admin: `Nuevo feature` modal/form: título, descripción, estado (`Pendiente` | `Hecho`), checkbox recordatorio + datetime (same pattern as notes). List rows with `Quitar`. Status shown as `Pendiente` / `Hecho`.
- Developer: list only (title, description, status). No form, no `Quitar`.

Keep `Miembros` and `Notas del proyecto` as they are.

## Error handling

| Case | Status |
| --- | --- |
| Not logged in | 401 |
| Developer finance or feature write | 403 |
| Developer GET finance or file | 403 |
| Developer GET features on a project they do not belong to | 403 |
| Missing project / item / feature / file | 404 |
| Invalid kind, amount, feature status | 400 |
| Bad or oversized file | 400 |

## Testing

Backend:

- Admin CRUD finance; developer 403 on GET/POST finance and file.
- File download 404 when `hasFile` is false; 200 with Content-Disposition when present.
- Admin CRUD features; member GET 200; non-member GET 403; developer POST 403.
- Reminder job sends one email for a due feature and sets `notifiedAt`; does not double-send.

Frontend:

- Project detail: admin sees `Finanzas` and feature form; developer does not see `Finanzas` or `Agregar`/`Quitar` on features; developer sees `Features` heading and titles.
- Finance form calls create with the chosen kind.
- Keep existing strings: `Miembros`, `No se encontró`, `Notas del proyecto`.

## Out of scope

- Developer editing or completing features
- Emailing members (not the creating admin) for feature reminders
- Recurring reminders, in-app toasts
- S3 / CDN, multiple files per item, file-only delete
- Excel import, currency conversion, tax, approvals
- Linking a finance item or feature to a Kanban task
- Client role

## Success criteria

1. Admin adds a cost with a note and a PDF; it lists under Costos; download works. A developer logged in on that project does not see the Finanzas card and GET finance returns 403.
2. Admin adds a budget line and a contract line; they appear in their sections; Presupuesto shows a total of budget lines only.
3. Admin creates a feature; the developer member sees it without edit controls.
4. Admin sets a feature reminder a minute in the future; when the cron ticks, only that admin’s email is used; `notifiedAt` is set; a second tick does not send again.
