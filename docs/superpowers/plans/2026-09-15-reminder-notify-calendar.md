# Reminder extra recipients and calendar invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authors can add extra people to a note or feature reminder; at due time each recipient (author always included) gets the reminder email with a `.ics` calendar attachment.

**Architecture:** Join tables `NoteNotify` and `FeatureNotify` store extra user ids. `resolveNotifyUserIds` validates membership (or any user for standalone notes). The existing minute cron loads extras, sends one `sendReminderEmail` per unique email with `buildReminderIcs`, then sets `notifiedAt` even if some sends fail.

**Tech Stack:** Express, Sequelize, React 19, Vitest/Jest, existing nodemailer SMTP. No Google Calendar API. No new npm calendar library — build ICS as a string.

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-15-reminder-notify-calendar-design.md` — implement it verbatim.
- Roles stay `admin` | `developer`. Kanban, finance, membership APIs, and task-assignment email stay unchanged.
- Error bodies `{ error: string }`. New exact string: `Invalid recipient`. Keep existing strings.
- Exact UI copy: `Avisar también a`. List extras: `También: {names}` comma-separated.
- Extra people chosen **on create only**. PUT must not rewrite notify rows.
- Author is never stored in the join table; always emailed. Duplicate author id in `notifyUserIds` is ignored.
- Project/task-scoped extras = ProjectMembers of that project. Standalone note = any portal user.
- Email subject stays `Recordatorio: {title}`. ICS `METHOD:PUBLISH`, `UID` `note-{id}@intelekia` or `feature-{id}@intelekia`, `DTEND` = `remindAt` + 30 minutes, `ORGANIZER` = `SMTP_FROM`, filename `reminder.ics`.
- `GET /users` stays admin-only. Standalone picker uses `GET /notify-users`.
- TDD: failing test first. Commit after each task. Do not push.
- Do not implement on a dirty `master`. At execution time use `superpowers:using-git-worktrees` on a branch such as `feat/reminder-notify-calendar`.

## File map

| File | Role |
|---|---|
| `back/src/models/noteNotify.js` | Join note ↔ extra user |
| `back/src/models/featureNotify.js` | Join feature ↔ extra user |
| `back/src/utils/notifyRecipients.js` | Validate `notifyUserIds` |
| `back/src/utils/reminderIcs.js` | `buildReminderIcs` |
| `back/src/utils/mailer.js` | Attach ICS on reminder mail |
| `back/src/controllers/notifyUsersController.js` | `GET /notify-users` |
| `back/src/controllers/notesController.js` | Create extras; list includes `notifyUsers` |
| `back/src/controllers/featuresController.js` | Same for features |
| `back/src/jobs/reminderJob.js` | Email author + extras |
| `front/src/api/notifyUsers.js` | `listNotifyUsers` |
| `front/src/components/notes/NotifyUserPicker.jsx` | Checkbox list |
| `front/src/components/notes/NoteFormModal.jsx` | Picker on reminder |
| `front/src/components/notes/NotesList.jsx` | `También:` line |
| `front/src/components/projects/ProjectFeaturesCard.jsx` | Picker + `También:` |

---

### Task 1: NoteNotify and FeatureNotify models

**Files:**
- Create: `back/src/models/noteNotify.js`
- Create: `back/src/models/featureNotify.js`
- Modify: `back/src/models/index.js`
- Test: `back/tests/models/noteNotify.test.js`

**Interfaces:**
- Consumes: Sequelize `DataTypes`, existing `Note`, `Feature`, `User`.
- Produces: models `NoteNotify`, `FeatureNotify`. Associations: `Note.belongsToMany(User, { through: NoteNotify, as: 'notifyUsers', foreignKey: 'noteId', otherKey: 'userId' })` and the inverse `User.belongsToMany(Note, { through: NoteNotify, as: 'notifiedNotes', foreignKey: 'userId', otherKey: 'noteId' })`. Same pattern for Feature with `as: 'notifyUsers'` / `as: 'notifiedFeatures'`. Unique index on `(noteId, userId)` and `(featureId, userId)`. `onDelete: 'CASCADE'` from parent.

- [ ] **Step 1: Write the failing test**

Create `back/tests/models/noteNotify.test.js`:

```javascript
const { sequelize, User, Note, NoteNotify, Feature, FeatureNotify, Project } = require('../../src/models');

describe('notify join tables', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('stores extra notify users on a note and a feature', async () => {
    const owner = await User.create({
      name: 'Owner',
      email: 'owner@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const extra = await User.create({
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const note = await Note.create({
      userId: owner.id,
      title: 'Ping',
      content: 'x',
      isReminder: true,
      remindAt: new Date(),
    });
    await NoteNotify.create({ noteId: note.id, userId: extra.id });
    const withUsers = await Note.findByPk(note.id, {
      include: { model: User, as: 'notifyUsers' },
    });
    expect(withUsers.notifyUsers.map((u) => u.id)).toEqual([extra.id]);

    const project = await Project.create({ name: 'Website Revamp' });
    const feature = await Feature.create({
      projectId: project.id,
      userId: owner.id,
      title: 'SSO',
      isReminder: true,
      remindAt: new Date(),
    });
    await FeatureNotify.create({ featureId: feature.id, userId: extra.id });
    const featureWithUsers = await Feature.findByPk(feature.id, {
      include: { model: User, as: 'notifyUsers' },
    });
    expect(featureWithUsers.notifyUsers.map((u) => u.id)).toEqual([extra.id]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && npm test -- tests/models/noteNotify.test.js`

Expected: FAIL (NoteNotify is not exported / association missing).

- [ ] **Step 3: Implement models and associations**

Create `back/src/models/noteNotify.js` matching `projectMember.js` (fields `noteId`, `userId`, unique index on both).

Create `back/src/models/featureNotify.js` with `featureId`, `userId`, unique index.

In `back/src/models/index.js`, require both models. After existing Note/User associations:

```javascript
Note.belongsToMany(User, {
  through: NoteNotify,
  as: 'notifyUsers',
  foreignKey: 'noteId',
  otherKey: 'userId',
});
User.belongsToMany(Note, {
  through: NoteNotify,
  as: 'notifiedNotes',
  foreignKey: 'userId',
  otherKey: 'noteId',
});
Feature.belongsToMany(User, {
  through: FeatureNotify,
  as: 'notifyUsers',
  foreignKey: 'featureId',
  otherKey: 'userId',
});
User.belongsToMany(Feature, {
  through: FeatureNotify,
  as: 'notifiedFeatures',
  foreignKey: 'userId',
  otherKey: 'featureId',
});
```

Export `NoteNotify` and `FeatureNotify` from the `module.exports` object.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back && npm test -- tests/models/noteNotify.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/models/noteNotify.js back/src/models/featureNotify.js back/src/models/index.js back/tests/models/noteNotify.test.js
git commit -m "feat: add notify join tables for note and feature reminders"
```

---

### Task 2: Validate recipients, GET /notify-users, notes create/list

**Files:**
- Create: `back/src/utils/notifyRecipients.js`
- Create: `back/src/controllers/notifyUsersController.js`
- Create: `back/src/routes/notifyUsers.js`
- Modify: `back/src/app.js` — `app.use('/notify-users', notifyUsersRoutes)` **before** `/users` is fine; path is different.
- Modify: `back/src/controllers/notesController.js`
- Test: `back/tests/utils/notifyRecipients.test.js`
- Test: `back/tests/routes/notes.test.js` (add cases)
- Test: `back/tests/routes/notifyUsers.test.js`

**Interfaces:**
- Consumes: `isProjectMember`, `User`, `Task` (for task-linked notes).
- Produces: `async function resolveNotifyUserIds(rawIds, { projectId, actorId })` → `number[]` (unique, actor removed). Throws `Error` with `message === 'Invalid recipient'` when any id is missing or, if `projectId` is set, not a member. If `projectId` is null/undefined, any existing user is allowed. Empty/missing `rawIds` → `[]`.
- `GET /notify-users` (requireAuth, any role) → `{ id, name }[]` all users except `req.user.id`, ordered by id.
- `POST /notes` accepts `notifyUserIds`. When `isReminder` is false, ignore it. When true, after insert, bulk-create `NoteNotify` in a transaction. Response includes `notifyUsers: { id, name }[]`.
- `GET /notes` includes `notifyUsers` the same shape.
- If `taskId` is set and `projectId` is not, load `Task.findByPk(taskId)` and use `task.projectId` for membership.

- [ ] **Step 1: Write failing tests**

`back/tests/utils/notifyRecipients.test.js`:

```javascript
const { sequelize, User, Project, ProjectMember } = require('../../src/models');
const { resolveNotifyUserIds } = require('../../src/utils/notifyRecipients');

describe('resolveNotifyUserIds', () => {
  let owner;
  let member;
  let outsider;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    owner = await User.create({ name: 'Owner', email: 'o@example.com', passwordHash: 'x', role: 'developer' });
    member = await User.create({ name: 'Ada', email: 'ada@example.com', passwordHash: 'x', role: 'developer' });
    outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: member.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('returns unique extras and drops the actor', async () => {
    const ids = await resolveNotifyUserIds([member.id, owner.id, member.id], {
      projectId: project.id,
      actorId: owner.id,
    });
    expect(ids).toEqual([member.id]);
  });

  it('rejects a non-member when project-scoped', async () => {
    await expect(
      resolveNotifyUserIds([outsider.id], { projectId: project.id, actorId: owner.id })
    ).rejects.toThrow('Invalid recipient');
  });

  it('allows any existing user when standalone', async () => {
    const ids = await resolveNotifyUserIds([outsider.id], { projectId: null, actorId: owner.id });
    expect(ids).toEqual([outsider.id]);
  });
});
```

`back/tests/routes/notifyUsers.test.js`: admin-only `/users` still 403 for developer; `GET /notify-users` 200 with `{ id, name }` and without the caller.

Add to `back/tests/routes/notes.test.js` (create Project, ProjectMember, Task as needed in the new tests, not in a way that breaks `beforeAll`):

- POST standalone reminder with `notifyUserIds: [other.id]` → 201, `notifyUsers` is `[{ id: other.id, name: 'Other' }]`, no owner row.
- POST project note reminder with non-member → 400 `{ error: 'Invalid recipient' }` and `Note.count` unchanged for that title.
- GET `/notes` includes `notifyUsers` on the created reminder.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/utils/notifyRecipients.test.js tests/routes/notifyUsers.test.js tests/routes/notes.test.js`

Expected: FAIL (module / route missing, notes body has no `notifyUsers`).

- [ ] **Step 3: Implement**

`resolveNotifyUserIds`:

```javascript
const { User } = require('../models');
const { isProjectMember } = require('./projectAccess');

async function resolveNotifyUserIds(rawIds, { projectId, actorId }) {
  if (rawIds == null || rawIds.length === 0) return [];
  const unique = [...new Set(rawIds.map(Number).filter((id) => Number.isFinite(id) && id !== Number(actorId)))];
  const extras = [];
  for (const userId of unique) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Invalid recipient');
    if (projectId != null && projectId !== '') {
      const ok = await isProjectMember(userId, Number(projectId));
      if (!ok) throw new Error('Invalid recipient');
    }
    extras.push(userId);
  }
  return extras;
}

module.exports = { resolveNotifyUserIds };
```

`notifyUsersController.list`: `User.findAll` ordered by id, filter `id !== req.user.id`, map `{ id, name }`.

Route file: `requireAuth` only (not `requireRole('admin')`).

`app.js`: `app.use('/notify-users', require('./routes/notifyUsers'));`

Notes create: wrap in `sequelize.transaction`. Determine `memberProjectId` = `projectId` or, if `taskId`, `const task = await Task.findByPk(taskId)` then `task.projectId` (if no task → existing 400/FK behavior is fine; if task missing return 400 `{ error: 'Task not found' }` only if you already have that string — otherwise let FK fail. Prefer: if `taskId` and task missing, `400 { error: 'Invalid recipient' }` is wrong. Keep current create behavior for missing task. If task exists, use its projectId).

On `Invalid recipient`, rollback and `return res.status(400).json({ error: 'Invalid recipient' })`.

Helper to JSON:

```javascript
function publicNotifyUsers(note) {
  return (note.notifyUsers || []).map((u) => ({ id: u.id, name: u.name }));
}
```

After create, reload with `include: { model: User, as: 'notifyUsers' }` and spread `notifyUsers: publicNotifyUsers(note)`.

List: same include.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/utils/notifyRecipients.test.js tests/routes/notifyUsers.test.js tests/routes/notes.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/utils/notifyRecipients.js back/src/controllers/notifyUsersController.js back/src/routes/notifyUsers.js back/src/app.js back/src/controllers/notesController.js back/tests/utils/notifyRecipients.test.js back/tests/routes/notifyUsers.test.js back/tests/routes/notes.test.js
git commit -m "feat: allow extra recipients on reminder notes"
```

---

### Task 3: Feature create/list extras

**Files:**
- Modify: `back/src/controllers/featuresController.js`
- Test: `back/tests/routes/features.test.js`

**Interfaces:**
- Consumes: `resolveNotifyUserIds` from Task 2 (projectId is always `project.id`).
- Produces: `POST /projects/:id/features` accepts `notifyUserIds` when `isReminder`; response and GET list include `notifyUsers: { id, name }[]`. Non-member → `400 { error: 'Invalid recipient' }` and no feature row. Ignore `notifyUserIds` when not a reminder.

- [ ] **Step 1: Write the failing tests** in `features.test.js`

Admin POST reminder with `notifyUserIds: [member.id]` → 201, `notifyUsers[0].name === 'Dev'`.

Admin POST reminder with `notifyUserIds: [outsider.id]` → 400 `{ error: 'Invalid recipient' }`.

GET list as member includes `notifyUsers` on that feature.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/routes/features.test.js`

Expected: FAIL (`notifyUsers` undefined / 201 instead of 400).

- [ ] **Step 3: Implement**

In `create`, transaction: `Feature.create` then `resolveNotifyUserIds(notifyUserIds, { projectId: project.id, actorId: req.user.id })` then `FeatureNotify.bulkCreate`. Catch `Invalid recipient` → 400. Reload with `notifyUsers`. Map list/create JSON the same as notes.

Do **not** change `update` to rewrite notify rows.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/routes/features.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/controllers/featuresController.js back/tests/routes/features.test.js
git commit -m "feat: allow extra recipients on feature reminders"
```

---

### Task 4: ICS builder and reminder email attachment

**Files:**
- Create: `back/src/utils/reminderIcs.js`
- Modify: `back/src/utils/mailer.js` — `sendReminderEmail`
- Test: `back/tests/utils/reminderIcs.test.js`
- Test: `back/tests/utils/mailer.test.js`

**Interfaces:**
- Consumes: `SMTP_FROM`.
- Produces: `function buildReminderIcs({ uid, title, description, start })` → ICS string. `start` is a Date. `DTEND` is start + 30 minutes, both UTC `YYYYMMDDTHHMMSSZ`. Must contain `BEGIN:VCALENDAR`, `METHOD:PUBLISH`, `UID:{uid}`, `SUMMARY:{escaped title}`, `ORGANIZER:mailto:{SMTP_FROM or ''}`.
- `sendReminderEmail({ to, note, uid, start })` keeps `subject` `Recordatorio: ${note.title}` and `text: note.content`. Adds `attachments: [{ filename: 'reminder.ics', content: ics, contentType: 'text/calendar' }]`. `uid` and `start` come from the job; if omitted in old tests, derive `uid` `note-unknown@intelekia` and `start` `new Date()` only if missing — **do not omit**: job always passes them. Mailer tests pass explicit uid/start.

ICS text escape: backslash, semicolon, comma, newlines → `\\` `\;` `\,` `\n`.

- [ ] **Step 1: Write the failing tests**

```javascript
const { buildReminderIcs } = require('../../src/utils/reminderIcs');

describe('buildReminderIcs', () => {
  it('emits a 30-minute PUBLISH event in UTC', () => {
    const ics = buildReminderIcs({
      uid: 'note-9@intelekia',
      title: 'Ping client',
      description: 'Send status',
      start: new Date('2026-09-15T20:05:00.000Z'),
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain('UID:note-9@intelekia');
    expect(ics).toContain('DTSTART:20260915T200500Z');
    expect(ics).toContain('DTEND:20260915T203500Z');
    expect(ics).toContain('SUMMARY:Ping client');
  });
});
```

Extend `mailer.test.js` reminder case: `sendReminderEmail` called with uid/start; `sendMail` received `attachments` whose `[0].filename` is `reminder.ics` and `content` contains `UID:note-9@intelekia`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/utils/reminderIcs.test.js tests/utils/mailer.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement `buildReminderIcs` and wire `sendReminderEmail`**

```javascript
function padIcsDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
```

Fold lines if needed is YAGNI under 75 chars for our titles.

`sendReminderEmail`:

```javascript
async function sendReminderEmail({ to, note, uid, start }) {
  const ics = buildReminderIcs({
    uid,
    title: note.title,
    description: note.content,
    start,
  });
  const client = getTransporter();
  await client.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Recordatorio: ${note.title}`,
    text: note.content,
    attachments: [{ filename: 'reminder.ics', content: ics, contentType: 'text/calendar' }],
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/utils/reminderIcs.test.js tests/utils/mailer.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/utils/reminderIcs.js back/src/utils/mailer.js back/tests/utils/reminderIcs.test.js back/tests/utils/mailer.test.js
git commit -m "feat: attach a calendar invite to reminder emails"
```

---

### Task 5: Cron emails extras and survives partial SMTP failure

**Files:**
- Modify: `back/src/jobs/reminderJob.js`
- Test: `back/tests/jobs/reminderJob.test.js`

**Interfaces:**
- Consumes: `NoteNotify` / `notifyUsers` include, `sendReminderEmail({ to, note, uid, start })`.
- Produces: For each due note, recipients = unique emails of `owner` + `notifyUsers`. `uid` `note-${note.id}@intelekia`, `start` `note.remindAt`. Features: `creator` + `notifyUsers`, uid `feature-${feature.id}@intelekia`, `note: { title, content: feature.description || '' }`. Per-recipient try/catch `console.error`; after the loop set `notifiedAt` and save. `sent` still counts **parent records** processed (existing `toBe(1)` stays valid for a single note with no extras).

- [ ] **Step 1: Write the failing tests**

Add a test: owner + extra `NoteNotify`; due note; `sendMail` called twice with those two `to` addresses; both attachments present; `notifiedAt` set; second `checkAndSendReminders` does not call `sendMail`.

Add a test: `sendMail` rejects on first call, resolves on second; `notifiedAt` still set.

Include `Note` with `include: [{ model: User, as: 'owner' }, { model: User, as: 'notifyUsers' }]`. Same for Feature `creator` + `notifyUsers`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && npm test -- tests/jobs/reminderJob.test.js`

Expected: FAIL (only one sendMail / notifiedAt null on throw).

- [ ] **Step 3: Implement the job loop**

```javascript
async function emailReminder({ people, title, content, uid, start }) {
  const seen = new Set();
  for (const person of people) {
    if (!person?.email || seen.has(person.email)) continue;
    seen.add(person.email);
    try {
      await sendReminderEmail({
        to: person.email,
        note: { title, content },
        uid,
        start,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
```

People array: `[note.owner, ...(note.notifyUsers || [])]`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && npm test -- tests/jobs/reminderJob.test.js && npm test`

Expected: reminder job PASS; full backend suite PASS.

- [ ] **Step 5: Commit**

```bash
git add back/src/jobs/reminderJob.js back/tests/jobs/reminderJob.test.js
git commit -m "feat: email every reminder recipient and keep notifiedAt on SMTP errors"
```

---

### Task 6: Picker UI and También line

**Files:**
- Create: `front/src/api/notifyUsers.js`
- Create: `front/src/components/notes/NotifyUserPicker.jsx`
- Create: `front/src/components/notes/NotifyUserPicker.test.jsx`
- Modify: `front/src/components/notes/NoteFormModal.jsx`
- Modify: `front/src/components/notes/NoteFormModal.test.jsx`
- Modify: `front/src/components/notes/NotesList.jsx`
- Modify: `front/src/pages/NotesPage.test.jsx`
- Modify: `front/src/components/projects/ProjectFeaturesCard.jsx`
- Modify: `front/src/components/projects/ProjectFeaturesCard.test.jsx`
- Modify: `front/src/api/features.js` if create payload is built in the card only (keep API as generic POST body).

**Interfaces:**
- Consumes: `listMembers(projectId)`, `listNotifyUsers()`, `listTasks()` when only `taskId` is set (read `projectId` from the matching task). `useAuth().user.id` to hide self from member lists.
- Produces: `listNotifyUsers()` → `GET /notify-users`. `NotifyUserPicker({ users, selectedIds, onToggle })` checkboxes labeled with `u.name`, accessible name `Avisar también a` via a `<Label>` on the group. `createNote` / `createFeature` send `notifyUserIds: number[]` when reminder is on (empty array ok). Lists show `También: Ada, Luis` when `notifyUsers.length > 0`.

- [ ] **Step 1: Write failing tests**

`NotifyUserPicker.test.jsx`: render users Ada (id 2) and Luis (id 3); current selection empty; click Ada; `onToggle` called with 2.

`NoteFormModal.test.jsx`: spy `listNotifyUsers` resolving `[{ id: 2, name: 'Ada' }]`. Open modal, check reminder, expect `Avisar también a` and `Ada`. Check Ada, submit reminder; `createNote` called with `notifyUserIds: [2]`. Current-user-as-member: spy members `[{ id: 1, name: 'Me' }, { id: 2, name: 'Ada' }]` with `AuthContext` user id 1 and `projectId={7}` — `Me` is not in the picker.

`NotesPage.test.jsx`: note with `notifyUsers: [{ id: 2, name: 'Ada' }]` shows `También: Ada`.

`ProjectFeaturesCard.test.jsx`: admin, reminder on, members Ada, checkbox, `createFeature` includes `notifyUserIds`. Listed feature with notifyUsers shows `También: Ada`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd front && npx vitest run src/components/notes/NotifyUserPicker.test.jsx src/components/notes/NoteFormModal.test.jsx src/pages/NotesPage.test.jsx src/components/projects/ProjectFeaturesCard.test.jsx`

Expected: FAIL (copy / payload missing).

- [ ] **Step 3: Implement UI**

`front/src/api/notifyUsers.js`:

```javascript
import api from './client';

export async function listNotifyUsers() {
  const res = await api.get('/notify-users');
  return res.data;
}
```

Picker: fieldset + legend or Label `Avisar también a`, map users to `<label><input type="checkbox" />{name}</label>`.

NoteFormModal: `useAuth` for `user.id`. When `isReminder` becomes true, load candidates: if `projectId` (prop or linked project) `listMembers`; else if `taskId` `listTasks()` then `listMembers(task.projectId)`; else `listNotifyUsers()`. Filter `String(u.id) !== String(user.id)`. Submit `notifyUserIds: isReminder ? selected : []`.

NotesList: `{note.notifyUsers?.length ? <p className="text-xs text-muted-foreground">También: {note.notifyUsers.map((u) => u.name).join(', ')}</p> : null}`

Features card: same picker using `listMembers(projectId)`; on list rows the También line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd front && npx vitest run src/components/notes src/pages/NotesPage.test.jsx src/components/projects/ProjectFeaturesCard.test.jsx && npm test`

Expected: PASS, full frontend suite green.

- [ ] **Step 5: Commit**

```bash
git add front/src/api/notifyUsers.js front/src/components/notes/NotifyUserPicker.jsx front/src/components/notes/NotifyUserPicker.test.jsx front/src/components/notes/NoteFormModal.jsx front/src/components/notes/NoteFormModal.test.jsx front/src/components/notes/NotesList.jsx front/src/pages/NotesPage.test.jsx front/src/components/projects/ProjectFeaturesCard.jsx front/src/components/projects/ProjectFeaturesCard.test.jsx
git commit -m "feat: pick extra reminder recipients in note and feature forms"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|---|---|
| NoteNotify / FeatureNotify unique pairs, author not stored | 1, 2, 3 |
| Invalid recipient 400, nothing persisted | 2, 3 |
| Standalone any user vs project members | 2 |
| GET /notify-users; GET /users stays admin | 2 |
| PUT does not change notify rows | 3 (explicit non-change) |
| Cron unique emails, ICS, notifiedAt after partial fail | 4, 5 |
| UID / 30 min DTEND / PUBLISH / reminder.ics | 4 |
| Avisar también a checkboxes; También: names | 6 |
| Create-only extras | 2, 3, 6 |
| Out of scope Google OAuth / BCC / recurring | none (not implemented) |
