import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import ProjectMembersCard from './ProjectMembersCard';
import * as projectsApi from '../../api/projects';
import * as usersApi from '../../api/users';

function renderCard(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <ProjectMembersCard projectId={7} />
    </AuthContext.Provider>
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
});
