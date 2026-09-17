import { describe, it, expect } from 'vitest';
import { dashboardItemHref } from './dashboardItemHref';

describe('dashboardItemHref', () => {
  it('routes each kind to the spec path', () => {
    expect(dashboardItemHref({ kind: 'task', id: 9, taskId: null, projectId: 1 })).toBe('/tasks/9');
    expect(dashboardItemHref({ kind: 'note_reminder', id: 3, taskId: 9, projectId: 1 })).toBe('/tasks/9');
    expect(dashboardItemHref({ kind: 'note_reminder', id: 3, taskId: null, projectId: 1 })).toBe('/projects/1');
    expect(dashboardItemHref({ kind: 'note_reminder', id: 3, taskId: null, projectId: null })).toBe('/notes');
    expect(dashboardItemHref({ kind: 'feature_reminder', id: 4, projectId: 1 })).toBe('/projects/1');
    expect(dashboardItemHref({ kind: 'project', id: 1, projectId: 1 })).toBe('/projects/1');
  });
});
