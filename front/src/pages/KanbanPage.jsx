import { useEffect, useRef, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import * as columnsApi from '../api/columns';
import { useAuth } from '../context/AuthContext';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskFormModal from '../components/kanban/TaskFormModal';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { isKanbanListed } from '../lib/projectStatus';
import { Button } from '@/components/ui/button';

export function rollbackTaskColumn(tasks, taskId, previousColumnId) {
  if (!tasks.some((task) => task.id === taskId)) return tasks;

  return tasks.map((task) =>
    task.id === taskId ? { ...task, columnId: previousColumnId } : task
  );
}

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [error, setError] = useState('');
  const [openTask, setOpenTask] = useState(null);
  const [applyingColumns, setApplyingColumns] = useState(false);
  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    projectsApi.listProjects().then((data) => {
      const boardProjects = data.filter((p) => isKanbanListed(p.status));
      setProjects(data);
      setSelectedProjectId((currentProjectId) => {
        if (boardProjects.some((project) => String(project.id) === String(currentProjectId))) {
          return currentProjectId;
        }
        return boardProjects[0] ? String(boardProjects[0].id) : '';
      });
    });
  }, []);

  useEffect(() => {
    let ignore = false;
    setTasks([]);
    setMembers([]);
    setColumns([]);

    if (!selectedProjectId) {
      return () => {
        ignore = true;
      };
    }

    tasksApi.listTasks({ projectId: selectedProjectId }).then((data) => {
      if (!ignore) setTasks(data);
    });
    projectsApi.listAssignees(selectedProjectId).then((data) => {
      if (!ignore) setMembers(data);
    });
    columnsApi.listColumns(selectedProjectId).then((data) => {
      if (!ignore) setColumns(data);
    });

    return () => {
      ignore = true;
    };
  }, [selectedProjectId]);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.type === 'column') {
      const activeColumnId = String(active.id).startsWith('column:')
        ? String(active.id).slice('column:'.length)
        : null;
      const overColumnId = String(over.id).startsWith('column:')
        ? String(over.id).slice('column:'.length)
        : null;
      if (!activeColumnId || !overColumnId) return;

      const oldIndex = columns.findIndex((column) => String(column.id) === activeColumnId);
      const newIndex = columns.findIndex((column) => String(column.id) === overColumnId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const projectId = selectedProjectId;
      const next = arrayMove(columns, oldIndex, newIndex).map((column, position) => ({
        ...column,
        position,
      }));
      setColumns(next);
      try {
        await columnsApi.reorderColumns(projectId, next.map((column) => column.id));
      } catch {
        const freshColumns = await columnsApi.listColumns(projectId);
        if (selectedProjectIdRef.current === projectId) setColumns(freshColumns);
      }
      return;
    }

    if (active.data.current?.type !== 'task') return;
    if (!String(active.id).startsWith('task:') || !String(over.id).startsWith('column:')) return;

    const taskId = Number(String(active.id).slice('task:'.length));
    const newColumnId = Number(String(over.id).slice('column:'.length));
    if (!Number.isFinite(taskId) || !Number.isFinite(newColumnId)) return;

    const previousColumnId = tasks.find((task) => task.id === taskId)?.columnId;
    if (previousColumnId === undefined) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, columnId: newColumnId } : t)));

    try {
      await tasksApi.updateTaskColumn(taskId, newColumnId);
    } catch {
      setTasks((prev) => rollbackTaskColumn(prev, taskId, previousColumnId));
    }
  }

  function handleTaskCreated(task) {
    setTasks((prev) => [...prev, task]);
  }

  function handleTaskDeleted(task) {
    setOpenTask(null);
    setTasks((prev) => prev.filter((row) => String(row.id) !== String(task.id)));
  }

  async function handleAddColumn(event) {
    event.preventDefault();
    const name = newColumnName.trim();
    if (!name) return;

    const projectId = selectedProjectId;
    try {
      setError('');
      const column = await columnsApi.createColumn(projectId, { name });
      if (selectedProjectIdRef.current === projectId) {
        setColumns((prev) => [...prev, column]);
        setNewColumnName('');
        setAddingColumn(false);
      }
    } catch (addError) {
      setError(addError.response?.data?.error || addError.message || 'No se pudo crear la columna');
    }
  }

  async function handleRenameColumn(columnId, name) {
    const projectId = selectedProjectId;
    const updated = await columnsApi.updateColumn(projectId, columnId, { name });
    if (selectedProjectIdRef.current === projectId) {
      setColumns((prev) =>
        prev.map((column) =>
          column.id === columnId ? { ...column, ...updated, name } : column
        )
      );
    }
  }

  async function handleDeleteColumn(columnId) {
    const projectId = selectedProjectId;
    await columnsApi.deleteColumn(projectId, columnId);
    if (selectedProjectIdRef.current === projectId) {
      setColumns((prev) => prev.filter((column) => column.id !== columnId));
    }
  }

  async function handleApplyColumnsToAll() {
    if (!selectedProjectId) return;
    try {
      setError('');
      setApplyingColumns(true);
      await columnsApi.applyColumnsToAll(selectedProjectId);
    } catch (applyError) {
      setError(applyError.response?.data?.error || applyError.message || 'No se pudieron copiar las columnas');
    } finally {
      setApplyingColumns(false);
    }
  }

  const boardProjects = projects.filter((p) => isKanbanListed(p.status));
  const selectedProject = boardProjects.find((p) => String(p.id) === String(selectedProjectId));
  const paused = selectedProject?.status === 'parado';
  const canReorderColumns = user.role === 'admin' && !paused;
  const visibleTasks = tasks.filter((t) => String(t.projectId) === String(selectedProjectId));

  function canDragTask(task) {
    if (paused) return false;
    return user.role === 'admin' || String(task.assigneeId) === String(user.id);
  }

  return (
    <div className="p-6">
      {boardProjects.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
            {boardProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                role="tab"
                aria-selected={String(selectedProjectId) === String(project.id)}
                onClick={() => setSelectedProjectId(String(project.id))}
                className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                  String(selectedProjectId) === String(project.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
          {selectedProjectId && !paused && (
            <TaskFormModal projectId={selectedProjectId} users={members} onCreated={handleTaskCreated} />
          )}
          {user.role === 'admin' && selectedProjectId && (
            <Button
              type="button"
              variant="outline"
              disabled={applyingColumns}
              onClick={handleApplyColumnsToAll}
            >
              Aplicar columnas a todos los proyectos
            </Button>
          )}
        </div>
      )}
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          <SortableContext items={columns.map((column) => `column:${column.id}`)}>
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={visibleTasks.filter((t) => String(t.columnId) === String(column.id))}
                canDragTask={canDragTask}
                isAdmin={user.role === 'admin'}
                canDragColumn={canReorderColumns}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onDelete={() => handleDeleteColumn(column.id)}
                onOpenTask={setOpenTask}
                members={members}
              />
            ))}
          </SortableContext>
          {user.role === 'admin' && selectedProjectId && !paused && (
            <div className="w-64 shrink-0 rounded-xl border border-dashed border-border p-2">
              {addingColumn ? (
                <form onSubmit={handleAddColumn}>
                  <input
                    autoFocus
                    aria-label="Nombre de columna"
                    value={newColumnName}
                    onChange={(event) => setNewColumnName(event.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </form>
              ) : (
                <button type="button" onClick={() => setAddingColumn(true)}>
                  + Columna
                </button>
              )}
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>
      </DndContext>
      <TaskDetailModal
        task={openTask}
        onClose={() => setOpenTask(null)}
        onDeleted={handleTaskDeleted}
      />
    </div>
  );
}
