import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { AuthContext } from '../context/AuthContext';
import * as dashboardApi from '../api/dashboard';

vi.mock('../api/dashboard', () => ({
  getDashboard: vi.fn(),
}));

const empty = {
  pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
  items: [],
};

function renderDash(role = 'admin') {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    dashboardApi.getDashboard.mockReset();
    dashboardApi.getDashboard.mockResolvedValue(empty);
  });

  it('greets the user, shows pulse labels, and drops the old tiles', async () => {
    dashboardApi.getDashboard.mockResolvedValueOnce({
      pulse: { overdue: 3, today: 0, remindersToday: 0, paused: 0 },
      items: [],
    });
    renderDash('admin');
    expect(await screen.findByText('Vencidas')).toBeInTheDocument();
    expect(screen.getByText('Hola, Ada')).toBeInTheDocument();
    expect(await screen.findByText('Vencidas y para hoy, más proyectos parados.')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Hoy')).toBeInTheDocument();
    expect(screen.getByText('Recordatorios')).toBeInTheDocument();
    expect(screen.getByText('Parados')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Kanban/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
  });

  it('shows the empty copy when there is nothing due', async () => {
    renderDash('developer');
    expect(await screen.findByText('Nada vencido ni para hoy')).toBeInTheDocument();
  });

  it('shows an error when the request fails', async () => {
    dashboardApi.getDashboard.mockRejectedValueOnce(new Error('nope'));
    renderDash();
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument();
  });

  it('shows the loading skeleton while the request is pending', () => {
    dashboardApi.getDashboard.mockReturnValueOnce(new Promise(() => {}));
    renderDash();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('renders typed rows, overdue date styling, and paused pills', async () => {
    const overdueAt = '2026-09-10T18:00:00.000Z';
    dashboardApi.getDashboard.mockResolvedValueOnce({
      pulse: { overdue: 1, today: 0, remindersToday: 2, paused: 1 },
      items: [
        {
          kind: 'task',
          id: 1,
          title: 'Late task',
          at: overdueAt,
          bucket: 'overdue',
          projectId: 7,
          projectName: 'Acme',
          taskId: null,
        },
        {
          kind: 'note_reminder',
          id: 2,
          title: 'Call',
          at: '2026-09-17T18:00:00.000Z',
          bucket: 'today',
          projectId: null,
          projectName: null,
          taskId: null,
        },
        {
          kind: 'feature_reminder',
          id: 3,
          title: 'SSO',
          at: '2026-09-17T18:00:00.000Z',
          bucket: 'today',
          projectId: 7,
          projectName: 'Acme',
          taskId: null,
        },
        {
          kind: 'project',
          id: 7,
          title: 'Acme',
          at: null,
          bucket: 'paused',
          projectId: 7,
          projectName: 'Acme',
          taskId: null,
        },
      ],
    });

    renderDash();

    const late = await screen.findByRole('link', { name: 'Late task' });
    expect(late).toHaveAttribute('href', '/tasks/1');
    expect(screen.getByText('Tarea')).toBeInTheDocument();
    expect(screen.getByText('Recordatorio')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getAllByText('Parado').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', '/notes');
    expect(screen.getByRole('link', { name: 'SSO' })).toHaveAttribute('href', '/projects/7');
    expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/projects/7');

    const overdueDate = new Date(overdueAt).toLocaleDateString('es-MX');
    const dateEl = screen.getByText(overdueDate);
    expect(dateEl.className).toMatch(/text-destructive/);
  });
});
