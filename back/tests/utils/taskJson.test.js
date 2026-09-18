const { parseEstimatedHours, toPublicTask } = require('../../src/utils/taskJson');

describe('taskJson', () => {
  describe('parseEstimatedHours', () => {
    it('skips undefined values', () => {
      expect(parseEstimatedHours(undefined)).toEqual({ skip: true });
    });

    it('parses null and blank values as null', () => {
      expect(parseEstimatedHours(null)).toEqual({ value: null });
      expect(parseEstimatedHours('')).toEqual({ value: null });
    });

    it('rejects negative values', () => {
      expect(parseEstimatedHours(-1)).toEqual({ error: 'Invalid estimated hours' });
    });

    it('rejects non-numeric values', () => {
      expect(parseEstimatedHours('abc')).toEqual({ error: 'Invalid estimated hours' });
    });
  });

  describe('toPublicTask', () => {
    it('includes numeric estimatedHours for admins', () => {
      const task = { id: 1, title: 'Task', estimatedHours: '2.5' };

      expect(toPublicTask(task, { role: 'admin' })).toEqual({
        id: 1,
        title: 'Task',
        estimatedHours: 2.5,
      });
    });

    it('keeps null estimatedHours for admins', () => {
      const task = { id: 1, title: 'Task', estimatedHours: null };

      expect(toPublicTask(task, { role: 'admin' })).toEqual({
        id: 1,
        title: 'Task',
        estimatedHours: null,
      });
    });

    it('omits estimatedHours for developers', () => {
      const task = { id: 1, title: 'Task', estimatedHours: 2.5 };

      expect(toPublicTask(task, { role: 'developer' })).toEqual({
        id: 1,
        title: 'Task',
      });
    });
  });
});
