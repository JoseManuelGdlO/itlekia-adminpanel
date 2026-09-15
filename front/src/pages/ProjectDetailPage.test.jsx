import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import { AuthContext } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';
import * as usersApi from '../api/users';
import * as financeApi from '../api/finance';
import * as featuresApi from '../api/features';

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role: 'admin' }, loading: false }}>
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function renderMissing() {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role: 'admin' }, loading: false }}>
      <MemoryRouter initialEntries={['/projects/99']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ProjectDetailPage', () => {
  it('fetches the project and shows only notes linked to it', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'active' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Kickoff notes', content: 'y', isReminder: false, projectId: 7 },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
    expect(notesApi.listNotes).toHaveBeenCalledWith({ projectId: '7' });
    expect(screen.getByText('Kickoff notes')).toBeInTheDocument();
    expect(screen.getByText('Miembros')).toBeInTheDocument();
  });

  it('shows a not-found message when the project is missing', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);

    renderMissing();

    expect(await screen.findByText('No se encontró')).toBeInTheDocument();
  });

  it('hides Finanzas for a developer', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'active' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);

    render(
      <AuthContext.Provider
        value={{ user: { id: 2, name: 'Dev', role: 'developer' }, loading: false }}
      >
        <MemoryRouter initialEntries={['/projects/7']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.queryByText('Finanzas')).not.toBeInTheDocument();
  });
});
