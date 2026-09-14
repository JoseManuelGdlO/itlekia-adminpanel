import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import ProjectMembersCard from './ProjectMembersCard';
import * as projectsApi from '../../api/projects';
import * as usersApi from '../../api/users';

function card(role, projectId = 7) {
  return (
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <ProjectMembersCard projectId={projectId} />
    </AuthContext.Provider>
  );
}

function renderCard(role, projectId) {
  return render(
    card(role, projectId)
  );
}

describe('ProjectMembersCard', () => {
  it('lets an admin add and remove members', async () => {
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
    ]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
      { id: 3, name: 'Dev Two', email: 'dev2@example.com', role: 'developer' },
    ]);
    vi.spyOn(projectsApi, 'addMember').mockResolvedValue({
      id: 3,
      name: 'Dev Two',
      email: 'dev2@example.com',
      role: 'developer',
    });
    vi.spyOn(projectsApi, 'removeMember').mockResolvedValue();

    renderCard('admin');

    await waitFor(() => expect(screen.getByText('Dev One')).toBeInTheDocument());
    expect(screen.getByText('dev1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Agregar')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Usuario' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dev Two' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Agregar'));

    await waitFor(() => expect(projectsApi.addMember).toHaveBeenCalledWith(7, 3));
    expect(await screen.findByText('Dev Two')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Quitar')[0]);
    await waitFor(() => expect(projectsApi.removeMember).toHaveBeenCalled());
  });

  it('shows a read-only list for developers', async () => {
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
    ]);

    renderCard('developer');

    await waitFor(() => expect(screen.getByText('Dev One')).toBeInTheDocument());
    expect(screen.queryByText('Agregar')).not.toBeInTheDocument();
    expect(screen.queryByText('Quitar')).not.toBeInTheDocument();
    expect(screen.queryByText('dev1@example.com')).not.toBeInTheDocument();
  });

  it('shows Sin miembros when the list is empty', async () => {
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    renderCard('admin');
    expect(await screen.findByText('Sin miembros')).toBeInTheDocument();
  });

  it('clears members on project change and ignores stale responses', async () => {
    let resolveSecond;
    let resolveThird;
    const secondMembers = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    const thirdMembers = new Promise((resolve) => {
      resolveThird = resolve;
    });
    vi.spyOn(projectsApi, 'listMembers')
      .mockResolvedValueOnce([{ id: 2, name: 'First Member' }])
      .mockImplementationOnce(() => secondMembers)
      .mockImplementationOnce(() => thirdMembers);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);

    const view = renderCard('admin', 7);
    expect(await screen.findByText('First Member')).toBeInTheDocument();

    view.rerender(card('admin', 8));
    expect(screen.queryByText('First Member')).not.toBeInTheDocument();

    view.rerender(card('admin', 9));
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledTimes(3));

    resolveSecond([{ id: 3, name: 'Stale Member' }]);
    await waitFor(() => expect(screen.queryByText('Stale Member')).not.toBeInTheDocument());

    resolveThird([{ id: 4, name: 'Current Member' }]);
    expect(await screen.findByText('Current Member')).toBeInTheDocument();
  });
});
