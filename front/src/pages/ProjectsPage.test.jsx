import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ProjectsPage from './ProjectsPage';
import * as projectsApi from '../api/projects';

function renderAs(role) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { id: 1, role }, loading: false }}>
        <ProjectsPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('ProjectsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the create-project form for admins', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);
    renderAs('admin');
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalled());
    expect(screen.getByText('Crear proyecto')).toBeInTheDocument();
  });

  it('hides the create-project form for developers', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);
    renderAs('developer');
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalled());
    expect(screen.queryByText('Crear proyecto')).not.toBeInTheDocument();
  });

  it('lists projects returned by the API', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Website Revamp', status: 'trabajando' },
    ]);
    renderAs('admin');
    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
    expect(screen.getAllByText('Trabajando')).not.toHaveLength(0);
  });

  it('shows admin status controls, delete, and archived projects under Archivados', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Website Revamp', status: 'trabajando' },
      { id: 2, name: 'Legacy Portal', status: 'archivado' },
    ]);
    renderAs('admin');

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());

    expect(screen.getAllByLabelText('Estado')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Archivados' })).toBeInTheDocument();
    expect(screen.getByText('Legacy Portal')).toBeInTheDocument();
  });

  it('shows developers only open projects with status pills', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Website Revamp', status: 'trabajando' },
      { id: 2, name: 'Legacy Portal', status: 'archivado' },
    ]);
    renderAs('developer');

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());

    expect(screen.getByText('Trabajando')).toBeInTheDocument();
    expect(screen.queryByText('Legacy Portal')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Archivados' })).not.toBeInTheDocument();
  });

  it('lets admins change a project status to Parado', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Website Revamp', status: 'trabajando' },
    ]);
    vi.spyOn(projectsApi, 'updateProject').mockResolvedValueOnce({
      id: 1,
      name: 'Website Revamp',
      status: 'parado',
    });
    renderAs('admin');

    await waitFor(() => expect(screen.getByLabelText('Estado')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'parado' } });

    await waitFor(() => expect(projectsApi.updateProject).toHaveBeenCalledWith(1, { status: 'parado' }));
    expect(screen.getAllByText('Parado')).not.toHaveLength(0);
  });

  it('lets admins confirm project deletion', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Website Revamp', status: 'trabajando' },
    ]);
    vi.spyOn(projectsApi, 'deleteProject').mockResolvedValueOnce();
    renderAs('admin');

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    await waitFor(() => expect(projectsApi.deleteProject).toHaveBeenCalledWith(1));
    expect(screen.queryByText('Website Revamp')).not.toBeInTheDocument();
  });
});
