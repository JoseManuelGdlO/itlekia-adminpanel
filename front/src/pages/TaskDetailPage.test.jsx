import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetailPage from './TaskDetailPage';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';

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

    render(
      <MemoryRouter initialEntries={['/tasks/9']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

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

    render(
      <MemoryRouter initialEntries={['/tasks/9']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Sin actividad')).toBeInTheDocument();
  });
});
