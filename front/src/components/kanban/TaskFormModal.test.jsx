import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import TaskFormModal from './TaskFormModal';
import * as tasksApi from '../../api/tasks';

describe('TaskFormModal', () => {
  it('creates a task and calls onCreated with the result', async () => {
    vi.spyOn(tasksApi, 'createTask').mockResolvedValueOnce({ id: 10, title: 'New task', status: 'todo' });
    const onCreated = vi.fn();

    render(
      <TaskFormModal projectId={1} users={[]} onCreated={onCreated} />
    );

    // The Dialog is closed initially: the form fields must not be reachable yet.
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    // Clicking the trigger must have actually opened the Dialog (not just rendered the button).
    expect(screen.getByLabelText('Título')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'New task' } });
      screen.getByText('Guardar').click();
    });

    expect(tasksApi.createTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: 1, title: 'New task' }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });
});
