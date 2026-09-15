import { useEffect, useRef, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import * as columnsApi from '../api/columns';
import { useAuth } from '../context/AuthContext';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskFormModal from '../components/kanban/TaskFormModal';

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
  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;

  useEffect(() => {
    projectsApi.listProjects().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(String(data[0].id));
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
    projectsApi.listMembers(selectedProjectId).then((data) => {
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
      const oldIndex = columns.findIndex((column) => String(column.id) === String(active.id));
      const newIndex = columns.findIndex((column) => String(column.id) === String(over.id));
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const projectId = selectedProjectId;
      const next = arrayMove(columns, oldIndex, newIndex);
      setColumns(next);
      try {
        await columnsApi.reorderColumns(projectId, next.map((column) => column.id));
      } catch {
        const freshColumns = await columnsApi.listColumns(projectId);
        if (selectedProjectIdRef.current === projectId) setColumns(freshColumns);
      }
      return;
    }

    const taskId = Number(active.id);
    const newColumnId = Number(over.id);
    const previousColumnId = tasks.find((task) => task.id === taskId)?.columnId;

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

  const visibleTasks = tasks.filter((t) => String(t.projectId) === String(selectedProjectId));

  function canDragTask(task) {
    return user.role === 'admin' || String(task.assigneeId) === String(user.id);
  }

  return (
    <div className="p-6">
      {projects.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
            {projects.map((project) => (
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
          {selectedProjectId && (
            <TaskFormModal projectId={selectedProjectId} users={members} onCreated={handleTaskCreated} />
          )}
        </div>
      )}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          <SortableContext items={columns.map((column) => String(column.id))}>
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={visibleTasks.filter((t) => String(t.columnId) === String(column.id))}
                canDragTask={canDragTask}
                isAdmin={user.role === 'admin'}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onDelete={() => handleDeleteColumn(column.id)}
              />
            ))}
          </SortableContext>
          {user.role === 'admin' && selectedProjectId && (
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
    </div>
  );
}
