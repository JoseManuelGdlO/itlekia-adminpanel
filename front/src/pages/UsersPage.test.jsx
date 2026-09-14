import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import UsersPage from './UsersPage';
import * as usersApi from '../api/users';

describe('UsersPage', () => {
  it('lists users fetched from the API', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValueOnce([
      { id: 1, name: 'Ada', email: 'ada@example.com', role: 'admin' },
      { id: 2, name: 'Dev One', email: 'dev1@example.com', role: 'developer' },
    ]);

    render(<UsersPage />);

    await waitFor(() => expect(screen.getByText('ada@example.com')).toBeInTheDocument());
    expect(screen.getByText('dev1@example.com')).toBeInTheDocument();
  });

  it('creates a user and adds it to the list', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValueOnce([]);
    vi.spyOn(usersApi, 'createUser').mockResolvedValueOnce({
      id: 3, name: 'New Dev', email: 'new@example.com', role: 'developer',
    });

    render(<UsersPage />);
    await waitFor(() => expect(usersApi.listUsers).toHaveBeenCalled());

    await act(async () => {
      screen.getByLabelText('Nombre').value = 'New Dev';
      screen.getByLabelText('Nombre').dispatchEvent(new Event('input', { bubbles: true }));
      screen.getByLabelText('Email').value = 'new@example.com';
      screen.getByLabelText('Email').dispatchEvent(new Event('input', { bubbles: true }));
      screen.getByLabelText('Password').value = 'secret123';
      screen.getByLabelText('Password').dispatchEvent(new Event('input', { bubbles: true }));
      screen.getByText('Crear usuario').click();
    });

    await waitFor(() => expect(screen.getByText('new@example.com')).toBeInTheDocument());
  });
});
