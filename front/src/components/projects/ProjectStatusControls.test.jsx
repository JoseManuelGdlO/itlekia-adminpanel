import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectStatusControls from './ProjectStatusControls';
import * as projectsApi from '../../api/projects';

const project = { id: 1, name: 'Website Revamp', status: 'trabajando' };

describe('ProjectStatusControls', () => {
  it('updates the project status from the Estado select', async () => {
    const updated = { ...project, status: 'parado' };
    const onUpdated = vi.fn();
    vi.spyOn(projectsApi, 'updateProject').mockResolvedValueOnce(updated);

    render(<ProjectStatusControls project={project} onUpdated={onUpdated} onDeleted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'parado' } });

    await waitFor(() => expect(projectsApi.updateProject).toHaveBeenCalledWith(1, { status: 'parado' }));
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it('opens a delete dialog and cancels without deleting', () => {
    vi.spyOn(projectsApi, 'deleteProject').mockResolvedValueOnce();

    render(<ProjectStatusControls project={project} onUpdated={vi.fn()} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText('¿Eliminar Website Revamp? Se borran tareas, notas, features y finanzas.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(projectsApi.deleteProject).not.toHaveBeenCalled();
  });

  it('confirms delete from the dialog', async () => {
    const onDeleted = vi.fn();
    vi.spyOn(projectsApi, 'deleteProject').mockResolvedValueOnce();

    render(<ProjectStatusControls project={project} onUpdated={vi.fn()} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1));

    await waitFor(() => expect(projectsApi.deleteProject).toHaveBeenCalledWith(1));
    expect(onDeleted).toHaveBeenCalledWith(project);
  });
});
