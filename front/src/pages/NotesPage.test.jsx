import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import NotesPage from './NotesPage';
import * as notesApi from '../api/notes';

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Me', role: 'developer' }, loading: false }}>
      <NotesPage />
    </AuthContext.Provider>
  );
}

describe('NotesPage', () => {
  it('lists notes and shows a reminder badge for reminder notes', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Loose note', content: 'x', isReminder: false },
      { id: 2, title: 'Ping client', content: 'y', isReminder: true, remindAt: '2026-09-20T10:00:00.000Z' },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText('Loose note')).toBeInTheDocument());
    expect(screen.getByText('Ping client')).toBeInTheDocument();
    expect(screen.getByText(/Recordatorio:/)).toBeInTheDocument();
  });

  it('deletes a note when its delete button is clicked', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Loose note', content: 'x', isReminder: false },
    ]);
    vi.spyOn(notesApi, 'deleteNote').mockResolvedValueOnce(undefined);

    renderPage();
    await waitFor(() => expect(screen.getByText('Loose note')).toBeInTheDocument());

    screen.getByRole('button', { name: 'Eliminar' }).click();

    await waitFor(() => expect(notesApi.deleteNote).toHaveBeenCalledWith(1));
  });

  it('shows an empty state when there are no notes', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('Aún no hay notas')).toBeInTheDocument();
  });

  it('shows extra notify users on a reminder note', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      {
        id: 2,
        title: 'Ping client',
        content: 'y',
        isReminder: true,
        remindAt: '2026-09-20T10:00:00.000Z',
        notifyUsers: [{ id: 2, name: 'Ada' }],
      },
    ]);

    renderPage();

    expect(await screen.findByText('También: Ada')).toBeInTheDocument();
  });

  it('edits a note from the pencil button', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([
      { id: 1, title: 'Loose note', content: 'x', isReminder: false },
    ]);
    vi.spyOn(notesApi, 'updateNote').mockResolvedValueOnce({
      id: 1,
      title: 'Edited note',
      content: 'x',
      isReminder: false,
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Edited note' } });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(notesApi.updateNote).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'Edited note', content: 'x' })
      )
    );
    expect(await screen.findByText('Edited note')).toBeInTheDocument();
  });
});
