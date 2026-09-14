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
      className={`w-64 flex-shrink-0 rounded p-2 ${isOver ? 'bg-blue-50' : 'bg-gray-100'}`}
    >
      <h2 className="mb-2 text-sm font-semibold">{COLUMN_LABELS[status]}</h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
