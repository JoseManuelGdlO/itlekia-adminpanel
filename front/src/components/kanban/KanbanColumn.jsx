import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';

export default function KanbanColumn({ column, tasks, canDragTask }) {
  const { setNodeRef, isOver } = useDroppable({ id: String(column.id) });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-xl p-2 ring-1 ring-border ${
        isOver ? 'bg-accent' : 'bg-card'
      }`}
    >
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>{column.name}</span>
        <span className="text-xs font-normal text-muted-foreground">{tasks.length}</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} draggable={!canDragTask || canDragTask(task)} />
        ))}
      </div>
    </div>
  );
}
