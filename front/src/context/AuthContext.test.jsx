import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as authApi from '../api/auth';

function Probe() {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'anonymous'}</div>
      <button onClick={() => login('admin@example.com', 'secret123')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts anonymous when /auth/me fails, then logs in and out', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValueOnce(new Error('not authenticated'));
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({ id: 1, email: 'admin@example.com', role: 'admin' });
    vi.spyOn(authApi, 'logout').mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('anonymous'));

    await act(async () => {
      screen.getByText('login').click();
    });
    expect(screen.getByTestId('user').textContent).toBe('admin@example.com');

    await act(async () => {
      screen.getByText('logout').click();
    });
    expect(screen.getByTestId('user').textContent).toBe('anonymous');
  });
});
