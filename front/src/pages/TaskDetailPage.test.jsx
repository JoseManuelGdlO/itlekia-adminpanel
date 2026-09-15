import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetailPage from './TaskDetailPage';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';
import { AuthContext } from '../context/AuthContext';

vi.mock('../components/tasks/TaskDescriptionEditor', () => ({
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

function renderPage(user = { id: 1, name: 'Ada', role: 'admin' }) {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter initialEntries={['/tasks/9']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('TaskDetailPage', () => {
  it('renders created and status_changed activity lines', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 9, title: 'Build homepage', description: 'x', status: 'in_progress' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([
      { id: 1, type: 'created', fromStatus: null, toStatus: 'todo', user: { id: 1, name: 'Ada' } },
      {
        id: 2,
        type: 'status_changed',
        fromStatus: 'To Do',
        toStatus: 'In Progress',
        user: { id: 2, name: 'Luis' },
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(tasksApi.listTaskActivities).toHaveBeenCalledWith('9');
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.getByText('Ada creó la tarea')).toBeInTheDocument();
    expect(screen.getByText('Luis movió To Do → In Progress')).toBeInTheDocument();
  });

  it('shows Sin actividad when there is no history', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([{ id: 9, title: 'Build homepage' }]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText('Sin actividad')).toBeInTheDocument();
  });

  it('renders sanitized rich text without edit controls for another developer', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      {
        id: 9,
        title: 'Build homepage',
        description: '<p>Hi <strong>there</strong><script>alert(1)</script></p>',
        assigneeId: 2,
      },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([]);

    renderPage({ id: 99, role: 'developer' });

    expect(await screen.findByText('there')).toBeInTheDocument();
    expect(screen.getByText('there').closest('.task-description-html')).not.toBeNull();
    expect(screen.queryByText('Guardar')).not.toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  it('allows the assignee to save a rich-text description', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      {
        id: 9,
        title: 'Build homepage',
        description: '<p>Old</p>',
        assigneeId: 7,
      },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'updateTask').mockResolvedValueOnce({
      id: 9,
      description: '<p>New <strong>copy</strong></p>',
    });

    renderPage({ id: 7, role: 'developer' });

    fireEvent.change(await screen.findByLabelText('Descripción'), {
      target: { value: '<p>New <strong>copy</strong></p>' },
    });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(tasksApi.updateTask).toHaveBeenCalledWith(9, {
        description: '<p>New <strong>copy</strong></p>',
      });
    });
  });

  it('restores the previous HTML and shows the API error when saving fails', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      {
        id: 9,
        title: 'Build homepage',
        description: '<p>Previous</p>',
        assigneeId: 7,
      },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValueOnce([]);
    vi.spyOn(tasksApi, 'updateTask').mockRejectedValueOnce({
      response: { data: { error: 'No se pudo guardar' } },
    });

    renderPage({ id: 7, role: 'developer' });

    const editor = await screen.findByLabelText('Descripción');
    fireEvent.change(editor, { target: { value: '<p>Unsaved</p>' } });
    fireEvent.click(screen.getByText('Guardar'));

    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(editor).toHaveValue('<p>Previous</p>');
  });
});
