import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import KanbanPage from './KanbanPage';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import * as usersApi from '../api/users';

function renderAs(role) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { id: 1, role }, loading: false }}>
        <KanbanPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('KanbanPage', () => {
  it('groups fetched tasks into their status columns', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Build homepage', status: 'todo' },
      { id: 2, title: 'Fix nav bug', status: 'in_progress' },
      { id: 3, title: 'QA pass', status: 'done' },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);

    renderAs('developer');

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();
    expect(screen.getByText('QA pass')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('lets an admin pick which project the dropdown is showing', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValueOnce([]);

    renderAs('admin');

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('1'));

    expect(screen.getByRole('option', { name: 'Project Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Project Beta' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '2' } });

    expect(select).toHaveValue('2');
  });
});
