import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';

describe('ProjectDetailPage', () => {
  it('fetches the project and shows only notes linked to it', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'active' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Kickoff notes', content: 'y', isReminder: false, projectId: 7 },
    ]);

    render(
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Website Revamp')).toBeInTheDocument());
    expect(notesApi.listNotes).toHaveBeenCalledWith({ projectId: '7' });
    expect(screen.getByText('Kickoff notes')).toBeInTheDocument();
  });

  it('shows a not-found message when the project is missing', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={['/projects/99']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('No se encontró')).toBeInTheDocument();
  });
});
