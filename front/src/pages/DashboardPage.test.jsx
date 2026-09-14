import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { AuthContext } from '../context/AuthContext';

function renderDash(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('DashboardPage', () => {
  it('greets the user and shows admin tiles', () => {
    renderDash('admin');
    expect(screen.getByText('Hola, Ada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kanban/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Usuarios/ })).toBeInTheDocument();
  });

  it('hides the Usuarios tile for developers', () => {
    renderDash('developer');
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
  });
});
