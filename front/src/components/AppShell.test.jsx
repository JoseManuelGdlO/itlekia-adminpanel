import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from './AppShell';
import { AuthContext } from '../context/AuthContext';

function renderWithUser(role, { path = '/' } = {}) {
  return render(
    <AuthContext.Provider
      value={{ user: { id: 1, name: 'Test User', role }, loading: false, logout: vi.fn() }}
    >
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AppShell', () => {
  it('shows the Usuarios link for admins', () => {
    renderWithUser('admin');
    expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it('hides the Usuarios link for developers', () => {
    renderWithUser('developer');
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('renders the Intelekia isotipo', () => {
    renderWithUser('admin');
    expect(screen.getByAltText('Intelekia')).toBeInTheDocument();
  });

  it('reveals nav titles when the rail is expanded', () => {
    renderWithUser('admin', { path: '/kanban' });
    expect(screen.queryByText('Proyectos')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menú' }));
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('shows a visible Salir control', () => {
    renderWithUser('admin');
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });

  it('sets the top-bar title from the route', () => {
    renderWithUser('admin', { path: '/kanban' });
    expect(screen.getByRole('heading', { level: 1, name: 'Kanban' })).toBeInTheDocument();
  });
});
