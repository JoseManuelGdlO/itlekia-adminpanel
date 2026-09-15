# Project status lifecycle and delete — Design Spec

**Date:** 2026-09-15
**Status:** Draft (pending user review)

## Purpose

Projects have four statuses so the team can see what is in progress, paused, hidden from developers, or archived. Admins can change that status from the project list and the project detail page, and can **delete** a project (with confirmation), which removes the project and everything attached to it.

Kanban columns, finance, membership, reminders, and task-assignment email stay as they are except where this spec says a **paused** project cannot move or create work.

## Statuses

`Project.status` is exactly one of:

| Value | UI label |
|---|---|
| `trabajando` | Trabajando |
| `parado` | Parado |
| `oculto` | Oculto |
| `archivado` | Archivado |

Default for **new** projects: `trabajando`.

**Migration of existing rows:** `active` → `trabajando`, `archived` → `archivado`. The old enum values are not kept.

## Who sees what

Roles stay `admin` | `developer`. Only **admin** may change `status` or delete.

| Status | Admin list / detail | Developer list / detail | Kanban tab |
|---|---|---|---|
| Trabajando | Yes | Yes (if member) | Yes |
| Parado | Yes | Yes (if member) | Yes, but frozen |
| Oculto | Yes | No | No |
| Archivado | Separate **Archivados** block | No | No |

`GET /projects` enforces this: a developer only receives member projects with `trabajando` or `parado`. An admin receives all four.

Direct URL to an oculto/archivado project: developer sees the existing “No se encontró” empty state.

## Paused (`parado`) behavior

On a paused project, nobody (including admin) may:

- Drag a task between columns
- Create a task (`Nueva tarea`)
- Create or reorder columns

Opening a task to read (and existing notes/features) is allowed. `PATCH /tasks/:id/column`, `POST /tasks` with that `projectId`, and column create/reorder return `403 { error: 'Project is paused' }`.

## Delete

Admin only (existing `requireRole('admin')`). UI shows a confirm dialog:

- Title/body: `¿Eliminar {nombre}? Se borran tareas, notas, features y finanzas.`
- Actions: **Cancelar** / **Eliminar**

Confirmed `DELETE /projects/:id` removes the project and related rows in one transaction: members, columns, tasks and their activities, notes linked to the project or those tasks, features and their notify rows, finance items (and stored files). `204`. Unknown id → `404 { error: 'Project not found' }`.

This is hard delete, not a status.

## API

Error body `{ error: string }`. New exact strings: `Invalid status`, `Project is paused`. Keep existing strings.

- `POST /projects`: admin; created `status` is `trabajando` (client does not send status).
- `PUT /projects/:id`: admin; `status` if present must be one of the four values; otherwise `400 { error: 'Invalid status' }`. Name/description unchanged.
- `DELETE /projects/:id`: admin; cascade as above.
- `GET /projects`: filtered as in **Who sees what**.

## UI

Exact labels: **Trabajando**, **Parado**, **Oculto**, **Archivado**, **Eliminar**, **Archivados**, **Cancelar**. Dialog copy as above.

**Projects list (admin):** each non-archived row: `StatusPill`, `<select>` of the four statuses, **Eliminar**. Archived rows live under heading **Archivados** with the same controls (so they can be un-archived). Developer list: pill only, no select, no Eliminar, no Archivados block.

**Project detail (admin):** same select and Eliminar next to the title. After successful delete, navigate to `/projects`.

**Kanban:** tabs only for projects `GET /projects` returned. Paused: no drag, hide **Nueva tarea** and **+ Columna**.

Replace the current Archivar / Reactivar toggle.

## Out of scope

Custom status names, per-developer hide, soft-delete, bulk delete, restoring a deleted project.
