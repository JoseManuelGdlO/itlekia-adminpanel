import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import TaskCard from './TaskCard';

describe('TaskCard', () => {
  it('opens the task from a click instead of navigating away', () => {
    const onOpen = vi.fn();
    render(
      <DndContext>
        <TaskCard
          task={{ id: 9, title: 'Teammate card', status: 'todo' }}
          columnPosition={0}
          draggable={false}
          onOpen={onOpen}
        />
      </DndContext>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Teammate card' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
    expect(screen.queryByRole('link', { name: 'Teammate card' })).not.toBeInTheDocument();
  });
});
