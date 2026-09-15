import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import KanbanPage from './KanbanPage';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import * as columnsApi from '../api/columns';

const defaultColumns = [
  { id: 11, name: 'To Do', position: 0, projectId: 1 },
  { id: 12, name: 'In Progress', position: 1, projectId: 1 },
  { id: 13, name: 'Review', position: 2, projectId: 1 },
  { id: 14, name: 'Done', position: 3, projectId: 1 },
];

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
  it('groups fetched tasks for the selected project into API columns', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Build homepage', columnId: 11, projectId: 1, assigneeId: 1 },
      { id: 2, title: 'Fix nav bug', columnId: 12, projectId: 1, assigneeId: 1 },
      { id: 3, title: 'QA pass', columnId: 14, projectId: 1, assigneeId: 2 },
      { id: 4, title: 'Other project card', columnId: 11, projectId: 2, assigneeId: 1 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

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

  it('lets a developer pick a project via tabs', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderAs('developer');

    const alpha = await screen.findByRole('tab', { name: 'Project Alpha' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Project Beta' }));
    expect(screen.getByRole('tab', { name: 'Project Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
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
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderAs('developer');

    const alphaTab = await screen.findByRole('tab', { name: 'Project Alpha' });
    const betaTab = screen.getByRole('tab', { name: 'Project Beta' });
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledWith('1'));
    fireEvent.click(screen.getByText('Nueva tarea'));

    expect(await screen.findByRole('option', { name: 'Alpha Developer' })).toBeInTheDocument();

    fireEvent.click(betaTab);
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledWith('2'));
    expect(screen.queryByRole('option', { name: 'Alpha Developer' })).not.toBeInTheDocument();

    fireEvent.click(alphaTab);
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
      { id: 1, title: 'Own card', columnId: 11, projectId: 1, assigneeId: '7' },
      { id: 2, title: 'Teammate card', columnId: 11, projectId: 1, assigneeId: 8 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

    renderAs('developer', 7);

    const ownCard = (await screen.findByRole('link', { name: 'Own card' })).closest('div.rounded-lg');
    const teammateCard = screen.getByRole('link', { name: 'Teammate card' }).closest('div.rounded-lg');

    expect(ownCard).toHaveAttribute('role', 'button');
    expect(ownCard).toHaveAttribute('tabindex', '0');
    expect(teammateCard).not.toHaveAttribute('role');
    expect(teammateCard).not.toHaveAttribute('tabindex');
  });

  it('lets an admin pick which project tab is showing', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha' },
      { id: 2, name: 'Project Beta' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderAs('admin');

    const alpha = await screen.findByRole('tab', { name: 'Project Alpha' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Project Beta' }));
    expect(screen.getByRole('tab', { name: 'Project Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
  });
});
