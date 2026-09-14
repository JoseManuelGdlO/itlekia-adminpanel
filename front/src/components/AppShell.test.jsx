import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from './AppShell';
import { AuthContext } from '../context/AuthContext';

function renderWithUser(role) {
  const AuthContextMock = AuthContext;
  return render(
    <AuthContextMock.Provider value={{ user: { id: 1, name: 'Test', role }, loading: false, logout: vi.fn() }}>
      <MemoryRouter>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    </AuthContextMock.Provider>
  );
}

describe('AppShell', () => {
  it('shows the Usuarios link for admins', () => {
    renderWithUser('admin');
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('hides the Usuarios link for developers', () => {
    renderWithUser('developer');
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
  });
});
