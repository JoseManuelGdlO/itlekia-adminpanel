import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';

const DOTS = ['bg-muted-foreground', 'bg-primary', 'bg-rail', 'bg-teal-soft'];

export default function TaskCard({ task, columnPosition, draggable = true }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: String(task.id),
    disabled: !draggable,
  });

  const dot = DOTS[(columnPosition ?? 0) % DOTS.length];
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={`rounded-lg bg-card p-2 text-sm shadow-card ring-1 ring-border ${
        draggable ? 'cursor-grab' : 'cursor-default'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 size-2 shrink-0 rounded-full ${dot}`} />
        <Link to={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
          {task.title}
        </Link>
      </div>
    </div>
  );
}
