import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';

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
      className="cursor-grab rounded border bg-white p-2 text-sm shadow-sm"
    >
      <Link to={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
        {task.title}
      </Link>
    </div>
  );
}
