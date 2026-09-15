import { useDraggable } from '@dnd-kit/core';

const DOTS = ['bg-muted-foreground', 'bg-primary', 'bg-rail', 'bg-teal-soft'];

export default function TaskCard({ task, columnPosition, draggable = true, onOpen, assigneeName = 'Sin asignar' }) {
  const { listeners, setNodeRef, transform } = useDraggable({
    id: `task:${task.id}`,
    data: { type: 'task' },
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
      className={`rounded-lg bg-card p-2 text-sm shadow-card ring-1 ring-border ${
        draggable ? 'cursor-grab' : 'cursor-default'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 size-2 shrink-0 rounded-full ${dot}`} />
        <button
          type="button"
          className="text-left text-primary hover:underline"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpen?.(task)}
        >
          {task.title}
        </button>
      </div>
      <p className="mt-1 pl-4 text-xs text-muted-foreground">{assigneeName}</p>
    </div>
  );
}
