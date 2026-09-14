import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function NotesList({ notes, onDelete }) {
  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="flex items-start justify-between rounded border p-3">
          <div>
            <p className="font-medium">{note.title}</p>
            <p className="text-sm text-gray-600">{note.content}</p>
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
