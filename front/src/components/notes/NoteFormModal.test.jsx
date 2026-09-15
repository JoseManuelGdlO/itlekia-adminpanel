import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import NoteFormModal from './NoteFormModal';
import * as notesApi from '../../api/notes';
import * as projectsApi from '../../api/projects';
import * as tasksApi from '../../api/tasks';
import * as notifyUsersApi from '../../api/notifyUsers';

const defaultUser = { id: 1, name: 'Me', role: 'developer' };

function renderModal(ui, { user = defaultUser } = {}) {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('NoteFormModal', () => {
  beforeEach(() => {
    // Default to empty lists so the lazily-fetched picker never hits a real
    // network call unless a test explicitly overrides these.
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(notifyUsersApi, 'listNotifyUsers').mockResolvedValue([]);
  });

  it('does not reveal the form fields until the trigger opens the Dialog', async () => {
    renderModal(<NoteFormModal onCreated={vi.fn()} />);

    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    expect(screen.getByLabelText('Título')).toBeInTheDocument();
  });

  it('reveals the datetime input only when the reminder checkbox is checked', async () => {
    renderModal(<NoteFormModal onCreated={vi.fn()} />);

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

    renderModal(<NoteFormModal onCreated={onCreated} />);

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

    renderModal(<NoteFormModal projectId={2} taskId={3} onCreated={onCreated} />);

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
    renderModal(<NoteFormModal projectId={2} onCreated={vi.fn()} />);

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

    renderModal(<NoteFormModal onCreated={onCreated} />);

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

    renderModal(<NoteFormModal onCreated={vi.fn()} />);

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

  it('shows extra recipients and sends notifyUserIds on a standalone reminder', async () => {
    notifyUsersApi.listNotifyUsers.mockResolvedValue([{ id: 2, name: 'Ada' }]);
    vi.spyOn(notesApi, 'createNote').mockResolvedValueOnce({ id: 10, title: 'Ping', isReminder: true });
    const onCreated = vi.fn();

    renderModal(<NoteFormModal onCreated={onCreated} />);

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Ping' } });
      fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'follow up' } });
      fireEvent.click(screen.getByLabelText('Convertir en recordatorio'));
    });

    expect(await screen.findByText('Avisar también a')).toBeInTheDocument();
    expect(screen.getByLabelText('Ada')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Ada'));
      fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: '2026-09-20T10:00' } });
      screen.getByText('Guardar').click();
    });

    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        isReminder: true,
        notifyUserIds: [2],
      })
    );
  });

  it('omits the current user from the project member picker', async () => {
    projectsApi.listMembers.mockResolvedValue([
      { id: 1, name: 'Me' },
      { id: 2, name: 'Ada' },
    ]);

    renderModal(<NoteFormModal projectId={7} onCreated={vi.fn()} />, {
      user: { id: 1, name: 'Me', role: 'developer' },
    });

    await act(async () => {
      screen.getByText('Nueva nota').click();
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Convertir en recordatorio'));
    });

    expect(await screen.findByLabelText('Ada')).toBeInTheDocument();
    expect(screen.queryByLabelText('Me')).not.toBeInTheDocument();
  });
});
