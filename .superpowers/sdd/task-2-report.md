# Task 2 Report: Assignee membership and sanitized create/update

## Status

DONE

## Implementation

- Added shared assignee membership validation for task creation and updates.
- Both admins and developers now receive `400 { error: 'Invalid assignee' }` when assigning a user who is not a member of the target project.
- Preserved the developer creator-membership check and its existing `403 { error: 'Forbidden' }` response.
- Sanitized descriptions on both task creation and update using `sanitizeDescription`.
- Returned `400 { error: 'Invalid description' }` for oversized descriptions.
- Stored blank HTML descriptions and empty-string assignee IDs as `null`.
- Kept admin project-move behavior and validated supplied assignees against the destination project.

## TDD Evidence

1. Updated the developer non-member expectation and added the requested admin membership, script stripping, blank HTML, and oversized description route tests before changing production code.
2. Ran `npm test -- tests/routes/tasks.test.js`.
3. Observed the expected RED result: 5 failures and 20 passes. The failures showed the old developer error, successful admin non-member assignment, unsanitized scripts, non-null blank HTML, and acceptance of oversized HTML.
4. Added the minimal controller implementation from the brief.
5. Re-ran the targeted suite and observed 25 passing tests.

## Verification

- Targeted suite: 1 suite passed, 25 tests passed.
- Complete backend suite: 30 suites passed, 153 tests passed.
- `git diff --check`: passed.
- IDE lint diagnostics for both modified JavaScript files: none.
- The pre-existing untracked plan file was not staged or committed.

## Commit

- `122d5b2 feat: require member assignees and sanitize task HTML`

## Concerns

None.

---

# Task 2 Re-review Fix

## Status

DONE

## Implementation

- Added admin PUT coverage for non-member assignees and description sanitization/blank HTML normalization.
- Added a regression test proving a project-only move cannot retain an assignee who is not a destination-project member.
- Updated task PUT validation to check the resulting assignee against the destination project before mutating or saving the task.

## Commands and Output

### RED

Command: `cd back && npm test -- tests/routes/tasks.test.js`

Output:

```text
FAIL tests/routes/tasks.test.js
  ● tasks routes › admin PUT rejects moving a task when its assignee is not a destination member

    Expected: 400
    Received: 200

Test Suites: 1 failed, 1 total
Tests:       1 failed, 27 passed, 28 total
Snapshots:   0 total
Time:        1.389 s
```

### Targeted GREEN

Command: `cd back && npm test -- tests/routes/tasks.test.js`

Output:

```text
Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total
Snapshots:   0 total
Time:        1.369 s, estimated 2 s
```

### Full Backend Verification

Command: `cd back && npm test`

Output:

```text
Test Suites: 30 passed, 30 total
Tests:       156 passed, 156 total
Snapshots:   0 total
Time:        7.317 s, estimated 8 s
```

### Additional Checks

Command: `git diff --check`

Output: exit code 0, no output.

IDE lint diagnostics for the modified controller and route test: no errors.

## Concerns

None. The pre-existing untracked plan file remains untouched and will not be committed.
