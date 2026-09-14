import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '../EmptyState';

export default function NotesList({ notes, onDelete }) {
  if (!notes.length) {
    return <EmptyState message="Aún no hay notas" />;
  }

  return (
    <ul className="divide-y divide-border">
      {notes.map((note) => (
        <li key={note.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-medium">{note.title}</p>
            <p className="text-sm text-muted-foreground">{note.content}</p>
            {note.isReminder && (
              <Badge variant="secondary" className="mt-1">
                Recordatorio: {new Date(note.remindAt).toLocaleString()}
              </Badge>
            )}
          </div>
          <Button variant="destructive" size="sm" onClick={() => onDelete(note.id)}>
            Eliminar
          </Button>
        </li>
      ))}
    </ul>
  );
}
