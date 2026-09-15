# Reminder extra recipients and calendar invite — Design Spec

**Date:** 2026-09-15
**Status:** Draft (pending user review)

## Purpose

When creating a **note reminder** or a **project feature reminder**, the author can add extra people to notify. At `remindAt`, each recipient (author always included) gets the existing reminder email **plus an `.ics` attachment** so they can add it to Gmail, Outlook, or a phone calendar.

Kanban, finance, membership rules, and task-assignment email stay unchanged.

## Access rules

Roles stay `admin` | `developer`.

- **Notes:** whoever can create a note today can set extra recipients on **create**. Owner still always receives the mail.
- **Features:** admin who creates the feature can set extra recipients on **create**. Creator still always receives the mail.
- Extra people are **not** editable after create (no new edit UI).

## Who can be added

- Feature, or note linked to a **project** or **task** → only **ProjectMembers** of that project.
- Standalone note (no project, no task) → any portal user.
- The current user is **omitted from the picker** (they already get the mail). If they appear in `notifyUserIds`, the server **dedupes** and does not store them in the join table.
- Invalid id, non-member when membership is required, or unknown user → `400 { error: 'Invalid recipient' }` and **nothing** is persisted.

## Data model

Two join tables, unique on the pair, `ON DELETE CASCADE` from the parent:

- `NoteNotify`: `noteId`, `userId`
- `FeatureNotify`: `featureId`, `userId`

The author is **not** stored there.

`Note` and `Feature` reminder columns (`isReminder`, `remindAt`, `notifiedAt`) stay as they are. Still **one-shot**.

## API

Error body `{ error: string }`. New exact string: `Invalid recipient`. Existing strings unchanged.

Create payloads may include `notifyUserIds: number[]` (omit or `[]` = author only). Ignored when `isReminder` is false.

JSON for a note/feature that is a reminder includes `notifyUsers: { id, name }[]` (extras only, not the author).

**Picker lists (frontend):**

- Project/task-scoped: existing `GET /projects/:id/members` (task notes use that task’s `projectId`).
- Standalone notes: `GET /notify-users` (any authenticated user) returns `{ id, name }[]` for all users except `req.user`. `GET /users` stays admin-only.

`PUT` notes/features does **not** change `NoteNotify` / `FeatureNotify` in this slice.

## Email and calendar

Cron remains every minute. Same due query (`isReminder`, `remindAt <= now`, `notifiedAt` null).

For each due note/feature:

1. Recipients = unique emails of **author** + join-table users that still exist and have email.
2. For each email, `sendReminderEmail` as today (`subject`: `Recordatorio: {title}`, `text`: note content or feature description) **and** attach `reminder.ics`.
3. If one send throws, log and continue. After all attempts, set `notifiedAt` so the job does not resend.

**ICS** (`METHOD:PUBLISH`, not a meeting RSVP):

- `UID`: `note-{id}@intelekia` or `feature-{id}@intelekia`
- `SUMMARY`: title
- `DESCRIPTION`: content/description
- `DTSTART`: `remindAt`
- `DTEND`: `remindAt` + 30 minutes
- `ORGANIZER`: `SMTP_FROM`

No Google Calendar OAuth.

## UI

Copy: **Avisar también a**. Shown only when the reminder checkbox is on, under the datetime field.

Checkboxes, one per eligible person (same visual weight as the assignee `<select>`). No new pages.

On note/feature lists, if extras exist: `También: {names joined by comma}`.

Forms: **Nueva nota** (`NoteFormModal`, including project/task scoped) and **Nuevo feature**.

## Testing (must cover)

- Note with a valid extra member stores `NoteNotify`; author is not a row.
- Non-member extra on a project note → `400 Invalid recipient`, no note row.
- Standalone note may notify any portal user.
- Feature extras must be project members; same 400 otherwise.
- Cron sends N emails (author + extras) with `.ics`; second tick sends 0.
- One SMTP failure still sets `notifiedAt` and does not block other recipients.
- UI: reminder checkbox reveals **Avisar también a**; current user is not listed.

## Out of scope

Arbitrary emails, Google Calendar sync, recurring reminders, in-app toasts, BCC-in-one-message, editing recipients after create, changing `GET /users` to non-admins.
