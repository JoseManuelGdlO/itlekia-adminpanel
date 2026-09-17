import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import TaskFormModal from './TaskFormModal';
import * as tasksApi from '../../api/tasks';

vi.mock('../tasks/TaskDescriptionEditor', () => ({
  default: function MockEditor({ value, onChange }) {
    return (
      <textarea
        aria-label="Descripción"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
}));

async function openForm() {
  render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);
  await act(async () => {
    screen.getByText('Nueva tarea').click();
  });
}

async function fillTitle(title) {
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: title } });
}

describe('TaskFormModal', () => {
  it('does not POST when Guardar is clicked', async () => {
    vi.spyOn(tasksApi, 'createTask');
    await openForm();
    await fillTitle('New task');

    await act(async () => {
      screen.getByText('Guardar').click();
    });

    expect(screen.getByText('¿Crear New task?')).toBeInTheDocument();
    expect(tasksApi.createTask).not.toHaveBeenCalled();
  });

  it('cancels create confirm and keeps the form values', async () => {
    vi.spyOn(tasksApi, 'createTask');
    await openForm();
    await fillTitle('New task');

    await act(async () => {
      screen.getByText('Guardar').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Cancelar' }).click();
    });

    expect(tasksApi.createTask).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Crear New task?')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('New task');
  });

  it('creates a task and calls onCreated after Crear', async () => {
    vi.spyOn(tasksApi, 'createTask').mockResolvedValueOnce({ id: 10, title: 'New task', status: 'todo' });
    const onCreated = vi.fn();

    render(
      <TaskFormModal projectId={1} users={[]} onCreated={onCreated} />
    );

    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    expect(screen.getByLabelText('Título')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'New task' } });
      screen.getByText('Guardar').click();
    });

    expect(tasksApi.createTask).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(tasksApi.createTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: 1, title: 'New task' }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  it('submits the rich-text description from the shared editor', async () => {
    vi.spyOn(tasksApi, 'createTask').mockResolvedValueOnce({ id: 11, title: 'Rich task', status: 'todo' });

    render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rich task' } });
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: '<p>Hi <strong>there</strong></p>' },
    });

    await act(async () => {
      screen.getByText('Guardar').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(tasksApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ description: '<p>Hi <strong>there</strong></p>' })
    );
  });

  it('shows the API error and keeps the dialog open when creation fails', async () => {
    vi.spyOn(tasksApi, 'createTask').mockRejectedValueOnce({
      response: { data: { error: 'Invalid description' } },
    });
    const onCreated = vi.fn();

    render(<TaskFormModal projectId={1} users={[]} onCreated={onCreated} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Bad task' } });

    await act(async () => {
      screen.getByText('Guardar').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(await screen.findByText('Invalid description')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
    expect(screen.queryByText('¿Crear Bad task?')).not.toBeInTheDocument();
  });

  it('disables Crear while the POST is in flight so a second click does not duplicate', async () => {
    let resolveCreate;
    vi.spyOn(tasksApi, 'createTask').mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'New task' } });
    await act(async () => {
      screen.getByText('Guardar').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });

    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
    expect(screen.getByText('Guardar')).toBeDisabled();

    await act(async () => {
      screen.getByRole('button', { name: 'Crear' }).click();
    });
    expect(tasksApi.createTask).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({ id: 10, title: 'New task' });
    });
  });

  it('opens a wide dialog so the editor can be used', async () => {
    render(<TaskFormModal projectId={1} users={[]} onCreated={vi.fn()} />);

    await act(async () => {
      screen.getByText('Nueva tarea').click();
    });

    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass('sm:max-w-4xl');
  });
});
