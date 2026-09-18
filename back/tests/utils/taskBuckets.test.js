const { leftmostColumnIds, columnBucket, bucketResolver } = require('../../src/utils/taskBuckets');
const { rightmostColumnIds } = require('../../src/utils/dashboardWindow');

describe('taskBuckets', () => {
  it('picks leftmost by position then lowest id', () => {
    const ids = leftmostColumnIds([
      { id: 3, projectId: 10, position: 0 },
      { id: 1, projectId: 10, position: 0 },
      { id: 2, projectId: 10, position: 1 },
      { id: 9, projectId: 11, position: 2 },
    ]);
    expect([...ids].sort()).toEqual([1, 9]);
  });

  it('treats a one-column board as done', () => {
    const columns = [{ id: 5, projectId: 1, position: 0 }];
    expect(columnBucket(5, columns)).toBe('done');
    expect(rightmostColumnIds(columns).has(5)).toBe(true);
  });

  it('splits a two-column board into todo and done', () => {
    const columns = [
      { id: 1, projectId: 1, position: 0 },
      { id: 2, projectId: 1, position: 1 },
    ];
    expect(columnBucket(1, columns)).toBe('todo');
    expect(columnBucket(2, columns)).toBe('done');
  });

  it('marks middle columns inProgress', () => {
    const columns = [
      { id: 1, projectId: 1, position: 0 },
      { id: 2, projectId: 1, position: 1 },
      { id: 3, projectId: 1, position: 2 },
      { id: 4, projectId: 1, position: 3 },
    ];
    expect(columnBucket(1, columns)).toBe('todo');
    expect(columnBucket(2, columns)).toBe('inProgress');
    expect(columnBucket(3, columns)).toBe('inProgress');
    expect(columnBucket(4, columns)).toBe('done');
  });

  it('builds a reusable bucket resolver', () => {
    const resolveBucket = bucketResolver([
      { id: 1, projectId: 1, position: 0 },
      { id: 2, projectId: 1, position: 1 },
      { id: 3, projectId: 1, position: 2 },
    ]);

    expect(resolveBucket(1)).toBe('todo');
    expect(resolveBucket(2)).toBe('inProgress');
    expect(resolveBucket(3)).toBe('done');
  });
});
