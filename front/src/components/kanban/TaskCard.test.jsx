import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import TaskCard from './TaskCard';

describe('TaskCard', () => {
  it('still links to the task when it is not draggable', () => {
    render(
      <MemoryRouter>
        <DndContext>
          <TaskCard task={{ id: 9, title: 'Teammate card', status: 'todo' }} draggable={false} />
        </DndContext>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Teammate card' })).toHaveAttribute('href', '/tasks/9');
  });
});
