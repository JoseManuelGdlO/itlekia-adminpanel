import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';

function errorMessage(error) {
  return error.response?.data?.error || error.message || 'No se pudo actualizar la columna';
}

export default function KanbanColumn({
  column,
  tasks,
  canDragTask,
  isAdmin = false,
  onRename,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [error, setError] = useState('');
  const { attributes, listeners, setNodeRef, transform, transition, isOver } = useSortable({
    id: String(column.id),
    data: { type: 'column' },
    disabled: { draggable: !isAdmin },
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  async function submitRename() {
    const nextName = name.trim();
    if (!nextName || nextName === column.name) {
      setName(column.name);
      setEditing(false);
      return;
    }

    try {
      setError('');
      await onRename(nextName);
      setEditing(false);
    } catch (renameError) {
      setName(column.name);
      setError(errorMessage(renameError));
    }
  }

  async function handleDelete() {
    try {
      setError('');
      await onDelete();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-64 shrink-0 flex-col rounded-xl p-2 ring-1 ring-border ${
        isOver ? 'bg-accent' : 'bg-card'
      }`}
    >
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
          >
            <input
              autoFocus
              aria-label={`Renombrar ${column.name}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={submitRename}
              className="min-w-0 rounded border border-border bg-background px-1"
            />
          </form>
        ) : isAdmin ? (
          <button type="button" onClick={() => setEditing(true)}>
            {column.name}
          </button>
        ) : (
          <span>{column.name}</span>
        )}
        <span className="flex items-center gap-1">
          <span className="text-xs font-normal text-muted-foreground">{tasks.length}</span>
          {isAdmin && (
            <button
              type="button"
              aria-label={`Mover columna ${column.name}`}
              className="cursor-grab text-muted-foreground"
              {...attributes}
              {...listeners}
            >
              ⋮⋮
            </button>
          )}
          {isAdmin && tasks.length === 0 && (
            <button type="button" aria-label="Quitar columna" onClick={handleDelete}>
              ×
            </button>
          )}
        </span>
      </h2>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            columnPosition={column.position}
            draggable={!canDragTask || canDragTask(task)}
          />
        ))}
      </div>
    </div>
  );
}
