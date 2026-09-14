import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import NoteFormModal from './NoteFormModal';
import * as notesApi from '../../api/notes';
import * as projectsApi from '../../api/projects';
import * as tasksApi from '../../api/tasks';

describe('NoteFormModal', () => {
  beforeEach(() => {
    // Default to empty lists so the lazily-fetched picker never hits a real
    // network call unless a test explicitly overrides these.
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
  });

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

  it('does not render the project/task picker when scoped to a fixed projectId or taskId', async () => {
    render(<NoteFormModal projectId={2} onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    expect(screen.queryByLabelText('Vincular a proyecto (opcional)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vincular a tarea (opcional)')).not.toBeInTheDocument();
    expect(projectsApi.listProjects).not.toHaveBeenCalled();
    expect(tasksApi.listTasks).not.toHaveBeenCalled();
  });

  it('shows a project/task picker on the standalone page and links the picked project on submit', async () => {
    projectsApi.listProjects.mockResolvedValueOnce([
      { id: 7, name: 'Website Revamp' },
      { id: 8, name: 'Mobile App' },
    ]);
    tasksApi.listTasks.mockResolvedValueOnce([{ id: 12, title: 'Fix nav bug' }]);
    vi.spyOn(notesApi, 'createNote').mockResolvedValueOnce({ id: 9, title: 'Linked note', isReminder: false });
    const onCreated = vi.fn();

    render(<NoteFormModal onCreated={onCreated} />);

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    await waitFor(() => expect(screen.getByLabelText('Vincular a proyecto (opcional)')).toBeInTheDocument());
    expect(screen.getByText('Website Revamp')).toBeInTheDocument();
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Linked note' } });
      fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'about the revamp' } });
      fireEvent.change(screen.getByLabelText('Vincular a proyecto (opcional)'), { target: { value: '7' } });
    });

    // Picking a project clears any previously picked task (mutually exclusive).
    expect(screen.getByLabelText('Vincular a tarea (opcional)').value).toBe('');

    await act(async () => {
      screen.getByText('Guardar').click();
    });

    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Linked note',
        content: 'about the revamp',
        projectId: '7',
        taskId: undefined,
      })
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  it('picking a task clears a previously picked project (mutually exclusive)', async () => {
    projectsApi.listProjects.mockResolvedValueOnce([{ id: 7, name: 'Website Revamp' }]);
    tasksApi.listTasks.mockResolvedValueOnce([{ id: 12, title: 'Fix nav bug' }]);

    render(<NoteFormModal onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    await waitFor(() => expect(screen.getByLabelText('Vincular a proyecto (opcional)')).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Vincular a proyecto (opcional)'), { target: { value: '7' } });
    });
    expect(screen.getByLabelText('Vincular a proyecto (opcional)').value).toBe('7');

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Vincular a tarea (opcional)'), { target: { value: '12' } });
    });

    expect(screen.getByLabelText('Vincular a tarea (opcional)').value).toBe('12');
    expect(screen.getByLabelText('Vincular a proyecto (opcional)').value).toBe('');
  });
});
