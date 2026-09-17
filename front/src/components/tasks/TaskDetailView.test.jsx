import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskDetailView from './TaskDetailView';
import * as tasksApi from '../../api/tasks';
import * as notesApi from '../../api/notes';
import * as projectsApi from '../../api/projects';
import { AuthContext } from '../../context/AuthContext';

vi.mock('./TaskDescriptionEditor', () => ({
  default: function MockEditor({ value, onChange }) {
    return (
      <textarea
        aria-label="Descripción"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  },
}));

const task = { id: 9, title: 'Build homepage', description: '<p>Hi</p>', projectId: 7, assigneeId: 1 };

afterEach(() => {
  vi.restoreAllMocks();
});

function renderView(user, props = {}) {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter>
        <TaskDetailView taskId={9} {...props} />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function mockDetail() {
  vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([task]);
  vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);
  vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValue([]);
  vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
}

describe('TaskDetailView delete', () => {
  it('shows Eliminar and the exact confirm copy for an admin', async () => {
    mockDetail();
    renderView({ id: 1, role: 'admin' });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    expect(
      screen.getByText('¿Eliminar Build homepage? Se borran notas e historial de la tarea.')
    ).toBeInTheDocument();
    expect(screen.getByText('Eliminar', { selector: '[data-slot="dialog-title"]' })).toBeInTheDocument();
  });

  it('cancels delete without calling deleteTask', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'deleteTask').mockResolvedValueOnce();
    renderView({ id: 1, role: 'admin' });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(tasksApi.deleteTask).not.toHaveBeenCalled();
    expect(
      screen.queryByText('¿Eliminar Build homepage? Se borran notas e historial de la tarea.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Build homepage')).toBeInTheDocument();
  });

  it('hides Eliminar from a developer', async () => {
    mockDetail();
    renderView({ id: 1, role: 'developer' });

    expect(await screen.findByText('Build homepage')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('confirms delete, calls deleteTask, then onDeleted', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'deleteTask').mockResolvedValueOnce();
    const onDeleted = vi.fn();
    renderView({ id: 1, role: 'admin' }, { onDeleted });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    await waitFor(() => expect(tasksApi.deleteTask).toHaveBeenCalledWith(9));
    expect(onDeleted).toHaveBeenCalledWith(expect.objectContaining({ id: 9, title: 'Build homepage' }));
  });

  it('keeps the dialog open and shows the API error when delete fails', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'deleteTask').mockRejectedValueOnce({
      response: { data: { error: 'Forbidden' } },
    });
    const onDeleted = vi.fn();
    renderView({ id: 1, role: 'admin' }, { onDeleted });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(
      screen.getByText('¿Eliminar Build homepage? Se borran notas e historial de la tarea.')
    ).toBeInTheDocument();
  });
});
