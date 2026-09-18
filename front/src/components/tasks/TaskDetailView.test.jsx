import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const task = {
  id: 9,
  title: 'Build homepage',
  description: '<p>Hi</p>',
  projectId: 7,
  assigneeId: 1,
  estimatedHours: null,
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    expect(await screen.findAllByText('Forbidden')).toHaveLength(2);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(
      screen.getByText('¿Eliminar Build homepage? Se borran notas e historial de la tarea.')
    ).toBeInTheDocument();
  });

  it('admin can save estimated hours', async () => {
    mockDetail();
    vi.spyOn(tasksApi, 'updateTask').mockResolvedValueOnce({ ...task, estimatedHours: 3 });
    renderView({ id: 1, role: 'admin' });
    fireEvent.change(await screen.findByLabelText('Tiempo estimado (h)'), { target: { value: '3' } });
    await waitFor(() => expect(tasksApi.updateTask).toHaveBeenCalledWith(
      9,
      { estimatedHours: 3 },
      { signal: expect.any(AbortSignal) }
    ));
  });

  it('ignores stale estimated hours saves after a newer value wins', async () => {
    mockDetail();
    const first = deferred();
    const second = deferred();
    vi.spyOn(tasksApi, 'updateTask')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockRejectedValueOnce(new Error('Nope'));
    renderView({ id: 1, role: 'admin' });

    const input = await screen.findByLabelText('Tiempo estimado (h)');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '2' } });
    await waitFor(() => expect(tasksApi.updateTask).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve({ ...task, estimatedHours: 2 });
    });
    await act(async () => {
      first.resolve({ ...task, estimatedHours: 1 });
    });

    fireEvent.change(input, { target: { value: '3' } });

    await waitFor(() => expect(input).toHaveValue(2));
  });

  it('hides estimated hours from a developer', async () => {
    mockDetail();
    renderView({ id: 1, role: 'developer' });
    expect(await screen.findByText('Build homepage')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tiempo estimado (h)')).not.toBeInTheDocument();
  });
});
