import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import ProjectsPage from './ProjectsPage';
import * as projectsApi from '../api/projects';

function renderAs(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, role }, loading: false }}>
      <ProjectsPage />
    </AuthContext.Provider>
  );
}

describe('ProjectsPage', () => {
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
      { id: 1, name: 'Website Revamp', status: 'active' },
    ]);
    renderAs('admin');
    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
  });
});
