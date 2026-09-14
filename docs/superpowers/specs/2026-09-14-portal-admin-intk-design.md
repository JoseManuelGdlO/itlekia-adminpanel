# portal-admin-intk — Design Spec

**Date:** 2026-09-14
**Status:** Approved

## Purpose

Portal interno tipo agencia para administrar proyectos y tareas. Dos roles:

- **Admin** — gestiona proyectos, tareas y usuarios (desarrolladores).
- **Developer** — ve y actualiza las tareas que le asignan, vía tablero Kanban.

No hay rol de cliente en este alcance.

## Architecture

Monorepo con dos carpetas independientes, comunicadas por API REST:

- `front/` — React + Vite + Tailwind + shadcn/ui (SPA)
- `back/` — Express + Sequelize + MySQL + JWT

El front consume el back vía fetch/axios, enviando el JWT (guardado en cookie httpOnly) en cada request. Un middleware de Express valida el token y el rol en cada ruta protegida.

## Data Model

### User
- id
- name
- email
- passwordHash
- role (`admin` | `developer`)
- createdAt

### Project
- id
- name
- description
- status (`active` | `archived`)
- createdAt

### Task
- id
- projectId (FK → Project)
- title
- description
- status (`todo` | `in_progress` | `review` | `done`)
- assigneeId (FK → User, nullable)
- dueDate (nullable)
- createdAt
- updatedAt

### Note
- id
- userId (FK → User, dueño)
- projectId (FK → Project, nullable)
- taskId (FK → Task, nullable)
- title
- content
- isReminder (boolean, default false)
- remindAt (datetime, nullable) — solo aplica si isReminder=true; recordatorio de una sola vez (no recurrente)
- notifiedAt (datetime, nullable) — se llena cuando ya se envió el correo
- createdAt

Una nota puede existir suelta (sin projectId/taskId) o vinculada a uno de los dos, nunca a ambos a la vez.

## Backend Endpoints

- `POST /auth/login` → devuelve JWT (cookie httpOnly)
- `POST /auth/logout`
- `GET /auth/me` → usuario autenticado actual

- `GET /users` (admin only)
- `POST /users` (admin only)
- `PUT /users/:id` (admin only)
- `DELETE /users/:id` (admin only)

- `GET /projects` (admin ve todos; developer ve solo los suyos vía tareas asignadas)
- `POST /projects` (admin only)
- `PUT /projects/:id` (admin only)
- `DELETE /projects/:id` (admin only)

- `GET /tasks` (filtrable por projectId, assigneeId)
- `POST /tasks` (admin only)
- `PUT /tasks/:id` (admin, o developer dueño de la tarea para campos limitados)
- `PATCH /tasks/:id/status` (mover tarjeta en el Kanban — admin o developer asignado)
- `DELETE /tasks/:id` (admin only)

- `GET /notes` (filtrable por projectId, taskId; siempre acotado al usuario dueño)
- `POST /notes`
- `PUT /notes/:id`
- `DELETE /notes/:id`

## Reminders / Email Notifications

- Envío de correo vía **Nodemailer** con SMTP genérico, configurado por variables de entorno: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Un job programado con **node-cron**, corriendo dentro del proceso de Express, se ejecuta cada minuto:
  - Busca notas con `isReminder = true`, `remindAt <= now()` y `notifiedAt IS NULL`.
  - Envía un correo al `email` del usuario dueño de la nota.
  - Marca `notifiedAt = now()` para no reenviar.
- Los recordatorios son de una sola ocurrencia (no recurrentes) en este alcance.

## Frontend Screens

- **Login**
- **Dashboard** — según rol: admin ve resumen global, developer ve solo sus tareas asignadas
- **Proyectos** (admin) — CRUD de proyectos
- **Usuarios** (admin) — CRUD de desarrolladores
- **Kanban de tareas** — tablero drag-and-drop entre columnas `To Do / In Progress / Review / Done`
- **Notas y Recordatorios** — lista de notas propias, con opción de marcar como recordatorio (selector de fecha/hora) y opción de vincularla a un proyecto o tarea existente
  - Dentro de la vista de un proyecto/tarea: sub-sección que muestra las notas vinculadas a ese ítem

## Auth

- JWT emitido en `/auth/login`, guardado en cookie httpOnly (no localStorage).
- Middleware de Express valida el token en cada ruta protegida y expone `req.user` (id, role).
- Rutas admin-only rechazan con 403 si `req.user.role !== 'admin'`.

## Out of Scope (this iteration)

- Rol de cliente / portal externo
- Recordatorios recurrentes
- Notificaciones push o in-app (solo email)
- Archivos adjuntos en tareas/notas
