import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthContext } from '../context/AuthContext';

function renderLogin(login = vi.fn()) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, login, logout: vi.fn() }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LoginPage', () => {
  it('shows Intelekia branding and the Ingresar action', () => {
    renderLogin();
    expect(screen.getByAltText('Intelekia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('shows an inline error when login fails', async () => {
    const login = vi.fn().mockRejectedValueOnce(new Error('bad'));
    renderLogin(login);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Ingresar' }).closest('form'));
    expect(await screen.findByText('Email o contraseña incorrectos')).toBeInTheDocument();
  });
});
