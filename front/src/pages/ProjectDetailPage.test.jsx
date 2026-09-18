import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import { AuthContext } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';
import * as usersApi from '../api/users';
import * as financeApi from '../api/finance';
import * as featuresApi from '../api/features';
import * as tasksApi from '../api/tasks';
import * as columnsApi from '../api/columns';

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role: 'admin' }, loading: false }}>
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes>
          <Route path="/projects" element={<div>Lista</div>} />
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
      { id: 7, name: 'Website Revamp', description: 'x', status: 'trabajando' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Kickoff notes', content: 'y', isReminder: false, projectId: 7 },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listAssignees').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

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
    vi.spyOn(projectsApi, 'listAssignees').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderMissing();

    expect(await screen.findByText('No se encontró')).toBeInTheDocument();
  });

  it('hides Finanzas for a developer', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'trabajando' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listAssignees').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

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
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
  });

  it('shows project status controls to an admin', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'trabajando' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listAssignees').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByLabelText('Estado')).toHaveValue('trabajando');
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('deletes a project from the detail page and navigates to the project list', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'trabajando' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listAssignees').mockResolvedValue([]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'deleteProject').mockResolvedValueOnce();

    renderPage();

    await screen.findByText('Website Revamp');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    await waitFor(() => expect(projectsApi.deleteProject).toHaveBeenCalledWith(7));
    expect(await screen.findByText('Lista')).toBeInTheDocument();
  });

  it('lets an admin see Nueva tarea and a task row', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'trabajando' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([{ id: 2, name: 'Dev' }]);
    vi.spyOn(projectsApi, 'listAssignees').mockResolvedValue([{ id: 2, name: 'Dev' }]);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([
      { id: 11, title: 'Build homepage', projectId: 7, assigneeId: 2, columnId: 3 },
    ]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([
      { id: 3, name: 'To Do', position: 0, projectId: 7 },
    ]);

    renderPage();

    const tasksCard = (await screen.findByText('Tareas')).closest('[data-slot="card"]');
    expect(within(tasksCard).getByText('Nueva tarea')).toBeInTheDocument();
    expect(await within(tasksCard).findByRole('link', { name: 'Build homepage' })).toHaveAttribute(
      'href',
      '/tasks/11'
    );
    expect(within(tasksCard).getByText('Dev')).toBeInTheDocument();
    expect(within(tasksCard).getByText('To Do')).toBeInTheDocument();
  });

  it('does not show the Tareas card to a developer', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp', description: 'x', status: 'trabajando' },
    ]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listAssignees').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

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
    expect(screen.queryByText('Tareas')).not.toBeInTheDocument();
    expect(screen.queryByText('Nueva tarea')).not.toBeInTheDocument();
  });
});
