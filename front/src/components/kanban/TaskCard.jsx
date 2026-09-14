import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';

const DOT = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-primary',
  review: 'bg-rail',
  done: 'bg-teal-soft',
};

export default function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-lg bg-card p-2 text-sm shadow-card ring-1 ring-border"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 size-2 shrink-0 rounded-full ${DOT[task.status] || DOT.todo}`} />
        <Link to={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
          {task.title}
        </Link>
      </div>
    </div>
  );
}
