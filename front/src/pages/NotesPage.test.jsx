import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NotesPage from './NotesPage';
import * as notesApi from '../api/notes';

describe('NotesPage', () => {
  it('lists notes and shows a reminder badge for reminder notes', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Loose note', content: 'x', isReminder: false },
      { id: 2, title: 'Ping client', content: 'y', isReminder: true, remindAt: '2026-09-20T10:00:00.000Z' },
    ]);

    render(<NotesPage />);

    await waitFor(() => expect(screen.getByText('Loose note')).toBeInTheDocument());
    expect(screen.getByText('Ping client')).toBeInTheDocument();
    expect(screen.getByText(/Recordatorio:/)).toBeInTheDocument();
  });

  it('deletes a note when its delete button is clicked', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Loose note', content: 'x', isReminder: false },
    ]);
    vi.spyOn(notesApi, 'deleteNote').mockResolvedValueOnce(undefined);

    render(<NotesPage />);
    await waitFor(() => expect(screen.getByText('Loose note')).toBeInTheDocument());

    screen.getByText('Eliminar').click();

    await waitFor(() => expect(notesApi.deleteNote).toHaveBeenCalledWith(1));
  });
});
