import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import NoteFormModal from './NoteFormModal';
import * as notesApi from '../../api/notes';

describe('NoteFormModal', () => {
  it('does not reveal the form fields until the trigger opens the Dialog', async () => {
    render(<NoteFormModal onCreated={vi.fn()} />);

    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    expect(screen.getByLabelText('Título')).toBeInTheDocument();
  });

  it('reveals the datetime input only when the reminder checkbox is checked', async () => {
    render(<NoteFormModal onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    expect(screen.queryByLabelText('Fecha y hora')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Convertir en recordatorio'));
    });

    expect(screen.getByLabelText('Fecha y hora')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Convertir en recordatorio'));
    });

    expect(screen.queryByLabelText('Fecha y hora')).not.toBeInTheDocument();
  });

  it('creates a standalone note (no reminder) and calls onCreated with the result', async () => {
    vi.spyOn(notesApi, 'createNote').mockResolvedValueOnce({ id: 5, title: 'New note', isReminder: false });
    const onCreated = vi.fn();

    render(<NoteFormModal onCreated={onCreated} />);

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'New note' } });
      fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'body' } });
      screen.getByText('Guardar').click();
    });

    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New note',
        content: 'body',
        isReminder: false,
        remindAt: undefined,
      })
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));

    // Dialog closes and resets after a successful submit.
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();
  });

  it('creates a reminder note with the chosen date/time', async () => {
    vi.spyOn(notesApi, 'createNote').mockResolvedValueOnce({ id: 6, title: 'Ping client', isReminder: true });
    const onCreated = vi.fn();

    render(<NoteFormModal projectId={2} taskId={3} onCreated={onCreated} />);

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Ping client' } });
      fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'follow up' } });
      fireEvent.click(screen.getByLabelText('Convertir en recordatorio'));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: '2026-09-20T10:00' } });
      screen.getByText('Guardar').click();
    });

    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ping client',
        content: 'follow up',
        projectId: 2,
        taskId: 3,
        isReminder: true,
        remindAt: '2026-09-20T10:00',
      })
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 6 }));
  });
});
