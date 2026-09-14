import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import KanbanPage from './KanbanPage';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';

function renderAs(role, userId = 1) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { id: userId, role }, loading: false }}>
        <KanbanPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('KanbanPage', () => {
  it('groups fetched tasks for the selected project into status columns', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Build homepage', status: 'todo', projectId: 1, assigneeId: 1 },
      { id: 2, title: 'Fix nav bug', status: 'in_progress', projectId: 1, assigneeId: 1 },
      { id: 3, title: 'QA pass', status: 'done', projectId: 1, assigneeId: 2 },
      { id: 4, title: 'Other project card', status: 'todo', projectId: 2, assigneeId: 1 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);

    renderAs('developer');

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();
    expect(screen.getByText('QA pass')).toBeInTheDocument();
    expect(screen.queryByText('Other project card')).not.toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('lets a developer pick a project and create a task', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);

    renderAs('developer');

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('1'));
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '2' } });
    expect(select).toHaveValue('2');
  });

  it('lets an admin pick which project the dropdown is showing', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);

    renderAs('admin');

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('1'));
    fireEvent.change(select, { target: { value: '2' } });
    expect(select).toHaveValue('2');
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
  });
});
