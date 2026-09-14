import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

  it('clears members on project switch and ignores an out-of-order response', async () => {
    let resolveBeta;
    let resolveCurrentAlpha;
    const betaMembers = new Promise((resolve) => {
      resolveBeta = resolve;
    });
    const currentAlphaMembers = new Promise((resolve) => {
      resolveCurrentAlpha = resolve;
    });

    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(projectsApi, 'listMembers')
      .mockResolvedValueOnce([{ id: 11, name: 'Alpha Developer' }])
      .mockImplementationOnce(() => betaMembers)
      .mockImplementationOnce(() => currentAlphaMembers);

    renderAs('developer');

    const projectSelect = await screen.findByRole('combobox');
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledWith('1'));
    fireEvent.click(screen.getByText('Nueva tarea'));

    expect(await screen.findByRole('option', { name: 'Alpha Developer' })).toBeInTheDocument();

    fireEvent.change(projectSelect, { target: { value: '2' } });
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledWith('2'));
    expect(screen.queryByRole('option', { name: 'Alpha Developer' })).not.toBeInTheDocument();

    fireEvent.change(projectSelect, { target: { value: '1' } });
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledTimes(3));

    await act(async () => {
      resolveBeta([{ id: 22, name: 'Stale Beta Developer' }]);
    });
    expect(screen.queryByRole('option', { name: 'Stale Beta Developer' })).not.toBeInTheDocument();

    await act(async () => {
      resolveCurrentAlpha([{ id: 33, name: 'Current Alpha Developer' }]);
    });
    expect(await screen.findByRole('option', { name: 'Current Alpha Developer' })).toBeInTheDocument();
  });

  it('lets a developer drag only their own task card', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Own card', status: 'todo', projectId: 1, assigneeId: 7 },
      { id: 2, title: 'Teammate card', status: 'todo', projectId: 1, assigneeId: 8 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);

    renderAs('developer', 7);

    const ownCard = (await screen.findByRole('link', { name: 'Own card' })).closest('div.rounded-lg');
    const teammateCard = screen.getByRole('link', { name: 'Teammate card' }).closest('div.rounded-lg');

    expect(ownCard).toHaveAttribute('role', 'button');
    expect(ownCard).toHaveAttribute('tabindex', '0');
    expect(teammateCard).not.toHaveAttribute('role');
    expect(teammateCard).not.toHaveAttribute('tabindex');
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
