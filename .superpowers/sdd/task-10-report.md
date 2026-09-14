# Task 10 Report: Kanban canvas per project, member create, own-card drag

## Status

DONE

## Implementation

- Added the project selector for both admin and developer users.
- Scoped visible Kanban cards to the selected project.
- Loaded project members through `projectsApi.listMembers(selectedProjectId)` and passed them to `TaskFormModal` through its existing `users` prop.
- Removed the Kanban page dependency on `usersApi.listUsers`.
- Kept empty status columns visible when there are no projects while hiding the project selector and `Nueva tarea`.
- Added per-card drag permissions: admins can drag all cards; developers can drag only cards assigned to their own user ID.
- Kept non-draggable task cards linked to their task detail page and kept `useDraggable` enabled with its `disabled` option.
- No backend files were changed.

## TDD Evidence

### RED

Command:

```bash
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskCard.test.jsx
```

Result: exit code 1. One test file failed and one passed; 2 of 4 tests failed.

Expected failures observed:

- `Other project card` was still rendered because tasks were not scoped to the selected project.
- A developer could not find the project `combobox`, so could not access `Nueva tarea`.
- The old admin-only users request also produced an unhandled network error, confirming `usersApi.listUsers` was still called.

### GREEN (focused)

Command:

```bash
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskCard.test.jsx src/components/kanban/TaskFormModal.test.jsx
```

Result: exit code 0; 3 test files passed, 5 tests passed.

### GREEN (full frontend suite)

Command:

```bash
npx vitest run
```

Result: exit code 0; 16 test files passed, 38 tests passed.

## Static Diagnostics

Cursor diagnostics reported no linter errors in the five changed source/test files.

## Concerns

The test commands emit an existing npm warning for the unknown `devdir` environment configuration. It does not affect test results.

---

## Important Review Fixes

### Changes

- Clear `members` immediately whenever `selectedProjectId` changes.
- Ignore member responses after their project-selection effect has been cleaned up, preventing out-of-order requests from overwriting the current project's members.
- Added a delayed project-switch regression test that checks immediate clearing, rejects a stale response, and accepts the current response.
- Added a focused developer authorization test proving their own card receives drag attributes while a teammate's card does not.
- Kept the existing non-draggable `TaskCard` link behavior test unchanged.
- No backend files were changed.

### TDD RED

Command:

```bash
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskCard.test.jsx
```

Full relevant output:

```text
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

 RUN  v5.0.0 C:/Users/Joczm/Desktop/freelancer/portal-admin-intk/.worktrees/feat-project-members/front

 ❯ src/pages/KanbanPage.test.jsx (5 tests | 1 failed) 509ms
   ❯ KanbanPage (5)
     × clears members on project switch and ignores an out-of-order response 159ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/pages/KanbanPage.test.jsx > KanbanPage > clears members on project switch and ignores an out-of-order response
Error: expect(element).not.toBeInTheDocument()

expected document not to contain element, found <option
  value="11"
>
  Alpha Developer
</option> instead
 ❯ src/pages/KanbanPage.test.jsx:90:75

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 5 passed (6)
   Start at  17:30:38
   Duration  3.51s (environment 55%, import 18%, tests 13%, setup 10%, transform 4%, worker 1%)
```

### Required focused verification

Command:

```bash
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskCard.test.jsx
```

Full relevant output:

```text
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

 RUN  v5.0.0 C:/Users/Joczm/Desktop/freelancer/portal-admin-intk/.worktrees/feat-project-members/front

 Test Files  2 passed (2)
      Tests  6 passed (6)
   Start at  17:30:55
   Duration  3.46s (environment 53%, import 18%, tests 16%, setup 9%, transform 4%, worker 1%)
```

### Required full frontend verification

Command:

```bash
npx vitest run
```

Full relevant output:

```text
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

 RUN  v5.0.0 C:/Users/Joczm/Desktop/freelancer/portal-admin-intk/.worktrees/feat-project-members/front

 Test Files  16 passed (16)
      Tests  40 passed (40)
   Start at  17:31:06
   Duration  12.72s (environment 53%, import 19%, tests 18%, setup 8%, transform 2%, worker 1%)

Environment  jsdom was created 16 times · 39.48s total, 53% of tracked time
             create it once per worker with pool: 'vmThreads' (keeps per-file isolation) or isolate: false (shares it across files)
             learn more: https://vitest.dev/guide/improving-performance#test-environments
```

### Static diagnostics

Cursor diagnostics reported no linter errors in the two changed frontend files.
