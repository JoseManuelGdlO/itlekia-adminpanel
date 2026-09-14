import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import KanbanPage from './KanbanPage';
import * as tasksApi from '../api/tasks';

function renderAs(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, role }, loading: false }}>
      <KanbanPage />
    </AuthContext.Provider>
  );
}

describe('KanbanPage', () => {
  it('groups fetched tasks into their status columns', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Build homepage', status: 'todo' },
      { id: 2, title: 'Fix nav bug', status: 'in_progress' },
      { id: 3, title: 'QA pass', status: 'done' },
    ]);

    renderAs('developer');

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();
    expect(screen.getByText('QA pass')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});
