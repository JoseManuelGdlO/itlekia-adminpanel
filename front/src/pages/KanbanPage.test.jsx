import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import KanbanPage, { rollbackTaskColumn } from './KanbanPage';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';
import * as projectsApi from '../api/projects';
import * as columnsApi from '../api/columns';

const dnd = vi.hoisted(() => ({
  dragEnd: null,
  useDraggable: vi.fn(({ disabled }) => ({
    attributes: disabled ? {} : { role: 'button', tabIndex: 0 },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
  })),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isOver: false,
  })),
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }) => {
      dnd.dragEnd = onDragEnd;
      return children;
    },
    useDraggable: dnd.useDraggable,
  };
});

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    SortableContext: ({ children }) => children,
    useSortable: dnd.useSortable,
  };
});

const defaultColumns = [
  { id: 11, name: 'To Do', position: 0, projectId: 1 },
  { id: 12, name: 'In Progress', position: 1, projectId: 1 },
  { id: 13, name: 'Review', position: 2, projectId: 1 },
  { id: 14, name: 'Done', position: 3, projectId: 1 },
];

function renderAs(role, userId = 1) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { id: userId, role }, loading: false }}>
        <KanbanPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('rollbackTaskColumn', () => {
  it('restores only the failed task and preserves every other task', () => {
    const tasks = [
      { id: 1, title: 'Failed drag', columnId: 12, projectId: 1 },
      { id: 2, title: 'Current task', columnId: 22, projectId: 2 },
    ];

    expect(rollbackTaskColumn(tasks, 1, 11)).toEqual([
      { id: 1, title: 'Failed drag', columnId: 11, projectId: 1 },
      tasks[1],
    ]);
  });

  it('leaves another project task list unchanged when the dragged task is absent', () => {
    const currentProjectTasks = [
      { id: 2, title: 'Current project task', columnId: 22, projectId: 2 },
    ];

    expect(rollbackTaskColumn(currentProjectTasks, 1, 11)).toBe(currentProjectTasks);
  });
});

describe('KanbanPage', () => {
  it('groups fetched tasks for the selected project into API columns', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Build homepage', columnId: 11, projectId: 1, assigneeId: 1 },
      { id: 2, title: 'Fix nav bug', columnId: 12, projectId: 1, assigneeId: 1 },
      { id: 3, title: 'QA pass', columnId: 14, projectId: 1, assigneeId: 2 },
      { id: 4, title: 'Other project card', columnId: 11, projectId: 2, assigneeId: 1 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

    renderAs('developer');

    await waitFor(() => expect(screen.getByText('Build homepage')).toBeInTheDocument());
    expect(screen.getByText('Fix nav bug')).toBeInTheDocument();
    expect(screen.getByText('QA pass')).toBeInTheDocument();
    expect(screen.queryByText('Other project card')).not.toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('namespaces equal task and column ids so both render as distinct draggables', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 11, title: 'Matching id card', columnId: 11, projectId: 1, assigneeId: 1 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValueOnce([defaultColumns[0]]);

    renderAs('admin');

    expect(await screen.findByRole('button', { name: 'Matching id card' })).toBeInTheDocument();
    expect(dnd.useSortable).toHaveBeenCalledWith(expect.objectContaining({
      id: 'column:11',
      data: { type: 'column' },
    }));
    expect(dnd.useDraggable).toHaveBeenCalledWith(expect.objectContaining({
      id: 'task:11',
      data: { type: 'task' },
    }));
  });

  it('moves a namespaced task to a namespaced column using numeric API ids', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 11, title: 'Matching id card', columnId: 11, projectId: 1, assigneeId: 1 },
    ]);
    vi.spyOn(tasksApi, 'updateTaskColumn').mockResolvedValueOnce({});
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValueOnce(defaultColumns.slice(0, 2));

    renderAs('admin');
    await screen.findByRole('button', { name: 'Matching id card' });

    await act(async () => {
      await dnd.dragEnd({
        active: { id: 'task:11', data: { current: { type: 'task' } } },
        over: { id: 'column:12' },
      });
    });

    expect(tasksApi.updateTaskColumn).toHaveBeenCalledWith(11, 12);
  });

  it('rewrites optimistic column positions after reordering', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Positioned card', columnId: 11, projectId: 1, assigneeId: 1 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValueOnce(defaultColumns.slice(0, 2));
    vi.spyOn(columnsApi, 'reorderColumns').mockResolvedValueOnce([]);

    renderAs('admin');
    const cardLink = await screen.findByRole('button', { name: 'Positioned card' });
    expect(cardLink.previousElementSibling).toHaveClass('bg-muted-foreground');

    await act(async () => {
      await dnd.dragEnd({
        active: { id: 'column:11', data: { current: { type: 'column' } } },
        over: { id: 'column:12' },
      });
    });

    expect(columnsApi.reorderColumns).toHaveBeenCalledWith('1', [12, 11]);
    expect(cardLink.previousElementSibling).toHaveClass('bg-primary');
  });

  it('lets a developer pick a project via tabs', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha', status: 'trabajando' },
      { id: 2, name: 'Project Beta', status: 'trabajando' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderAs('developer');

    const alpha = await screen.findByRole('tab', { name: 'Project Alpha' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Project Beta' }));
    expect(screen.getByRole('tab', { name: 'Project Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
  });

  it('reloads project-scoped tasks when switching tabs', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockImplementation(({ projectId } = {}) => {
      if (String(projectId) === '1' || projectId === undefined) {
        return Promise.resolve([
          { id: 1, title: 'Alpha card', columnId: 11, projectId: 1, assigneeId: 1 },
        ]);
      }
      return Promise.resolve([]);
    });
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha', status: 'trabajando' },
      { id: 2, name: 'Project Beta', status: 'trabajando' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

    renderAs('developer');

    expect(await screen.findByRole('button', { name: 'Alpha card' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Project Beta' }));

    await waitFor(() => expect(tasksApi.listTasks).toHaveBeenCalledWith({ projectId: '2' }));
    expect(screen.queryByRole('button', { name: 'Alpha card' })).not.toBeInTheDocument();
  });

  it('clears members on project switch and ignores an out-of-order response', async () => {
    let resolveBeta;
    let resolveCurrentAlpha;
    const betaMembers = new Promise((resolve) => {
      resolveBeta = resolve;
    });
    const currentAlphaMembers = new Promise((resolve) => {
      resolveCurrentAlpha = resolve;
    });

    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha', status: 'trabajando' },
      { id: 2, name: 'Project Beta', status: 'trabajando' },
    ]);
    vi.spyOn(projectsApi, 'listMembers')
      .mockResolvedValueOnce([{ id: 11, name: 'Alpha Developer' }])
      .mockImplementationOnce(() => betaMembers)
      .mockImplementationOnce(() => currentAlphaMembers);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderAs('developer');

    const alphaTab = await screen.findByRole('tab', { name: 'Project Alpha' });
    const betaTab = screen.getByRole('tab', { name: 'Project Beta' });
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledWith('1'));
    fireEvent.click(screen.getByText('Nueva tarea'));

    expect(await screen.findByRole('option', { name: 'Alpha Developer' })).toBeInTheDocument();

    fireEvent.click(betaTab);
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledWith('2'));
    expect(screen.queryByRole('option', { name: 'Alpha Developer' })).not.toBeInTheDocument();

    fireEvent.click(alphaTab);
    await waitFor(() => expect(projectsApi.listMembers).toHaveBeenCalledTimes(3));

    await act(async () => {
      resolveBeta([{ id: 22, name: 'Stale Beta Developer' }]);
    });
    expect(screen.queryByRole('option', { name: 'Stale Beta Developer' })).not.toBeInTheDocument();

    await act(async () => {
      resolveCurrentAlpha([{ id: 33, name: 'Current Alpha Developer' }]);
    });
    expect(await screen.findByRole('option', { name: 'Current Alpha Developer' })).toBeInTheDocument();
  });

  it('lets a developer drag only their own task card', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Own card', columnId: 11, projectId: 1, assigneeId: '7' },
      { id: 2, title: 'Teammate card', columnId: 11, projectId: 1, assigneeId: 8 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValueOnce([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

    renderAs('developer', 7);

    const ownCard = (await screen.findByRole('button', { name: 'Own card' })).closest('div.rounded-lg');
    const teammateCard = screen.getByRole('button', { name: 'Teammate card' }).closest('div.rounded-lg');

    expect(ownCard).toHaveClass('cursor-grab');
    expect(teammateCard).toHaveClass('cursor-default');
  });

  it('lets an admin pick which project tab is showing', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([
      { id: 1, name: 'Project Alpha', status: 'trabajando' },
      { id: 2, name: 'Project Beta', status: 'trabajando' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);

    renderAs('admin');

    const alpha = await screen.findByRole('tab', { name: 'Project Alpha' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Project Beta' }));
    expect(screen.getByRole('tab', { name: 'Project Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
  });

  it('does not show oculto or archivado projects as kanban tabs', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([
      { id: 1, name: 'Live', status: 'trabajando' },
      { id: 2, name: 'Hidden', status: 'oculto' },
      { id: 3, name: 'Old', status: 'archivado' },
    ]);
    // members/columns/tasks empty mocks
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    renderAs('admin');
    expect(await screen.findByRole('tab', { name: 'Live' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Hidden' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Old' })).not.toBeInTheDocument();
  });

  it('hides nueva tarea and column add when the project is parado', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([
      { id: 1, name: 'Paused board', status: 'parado' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([]);
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    renderAs('admin');
    expect(await screen.findByRole('tab', { name: 'Paused board' })).toBeInTheDocument();
    expect(screen.queryByText('Nueva tarea')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Columna')).not.toBeInTheDocument();
  });

  it('shows task cards as non-draggable on a paused board for admins', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([
      { id: 1, title: 'Paused card', columnId: 11, projectId: 1, assigneeId: 1 },
    ]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([
      { id: 1, name: 'Paused board', status: 'parado' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

    renderAs('admin');

    const card = (await screen.findByRole('button', { name: 'Paused card' })).closest('div.rounded-lg');
    expect(card).toHaveClass('cursor-default');
  });

  it('keeps paused board column rename and delete available while disabling column drag', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValueOnce([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([
      { id: 1, name: 'Paused board', status: 'parado' },
    ]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([defaultColumns[0]]);

    renderAs('admin');

    expect(await screen.findByRole('button', { name: 'To Do' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar columna' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mover columna To Do' })).not.toBeInTheDocument();
  });

  it('lets an admin add a column and hides that chrome from a developer', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([
      { id: 11, name: 'To Do', position: 0, projectId: 1 },
    ]);
    vi.spyOn(columnsApi, 'createColumn').mockResolvedValue({
      id: 15,
      name: 'Blocked',
      position: 1,
      projectId: 1,
    });

    renderAs('admin');
    expect(await screen.findByText('+ Columna')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Columna'));
    fireEvent.change(screen.getByLabelText('Nombre de columna'), { target: { value: 'Blocked' } });
    fireEvent.submit(screen.getByLabelText('Nombre de columna').closest('form'));
    await waitFor(() => expect(columnsApi.createColumn).toHaveBeenCalledWith('1', { name: 'Blocked' }));
    expect(await screen.findByText('Blocked')).toBeInTheDocument();
  });

  it('lets an admin rename a column inline', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([defaultColumns[0]]);
    vi.spyOn(columnsApi, 'updateColumn').mockResolvedValue({
      ...defaultColumns[0],
      name: 'Backlog',
    });

    renderAs('admin');
    fireEvent.click(await screen.findByRole('button', { name: 'To Do' }));
    const input = screen.getByLabelText('Renombrar To Do');
    fireEvent.change(input, { target: { value: 'Backlog' } });
    fireEvent.blur(input);

    await waitFor(() => expect(columnsApi.updateColumn).toHaveBeenCalledWith(
      '1',
      11,
      { name: 'Backlog' },
    ));
    expect(await screen.findByRole('button', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('does not show + Columna to a developer', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue([
      { id: 11, name: 'To Do', position: 0, projectId: 1 },
    ]);
    renderAs('developer');
    await screen.findByText('To Do');
    expect(screen.queryByText('+ Columna')).not.toBeInTheDocument();
  });

  it('opens the task in a wide modal instead of navigating', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([
      { id: 9, title: 'Own card', columnId: 11, projectId: 1, assigneeId: 7, description: '<p>Hi</p>' },
    ]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValue([]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

    renderAs('developer', 7);

    fireEvent.click(await screen.findByRole('button', { name: 'Own card' }));

    expect(await screen.findByText('Notas de la tarea')).toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass('sm:max-w-4xl');
  });

  it('shows the assignee name on each kanban card', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([
      { id: 9, title: 'Own card', columnId: 11, projectId: 1, assigneeId: 7 },
      { id: 10, title: 'Open card', columnId: 11, projectId: 1, assigneeId: null },
    ]);
    vi.spyOn(tasksApi, 'listTaskActivities').mockResolvedValue([]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([{ id: 1, name: 'Project Alpha', status: 'trabajando' }]);
    vi.spyOn(projectsApi, 'listMembers').mockResolvedValue([{ id: 7, name: 'Ada' }]);
    vi.spyOn(columnsApi, 'listColumns').mockResolvedValue(defaultColumns);

    renderAs('admin');

    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });
});
