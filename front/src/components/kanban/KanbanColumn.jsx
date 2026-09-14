import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';

const COLUMN_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export default function KanbanColumn({ status, tasks }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-xl p-2 ring-1 ring-border ${
        isOver ? 'bg-accent' : 'bg-card'
      }`}
    >
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>{COLUMN_LABELS[status]}</span>
        <span className="text-xs font-normal text-muted-foreground">{tasks.length}</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
