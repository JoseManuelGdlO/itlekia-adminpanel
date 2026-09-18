import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '../EmptyState';
import NoteFormModal from './NoteFormModal';

export default function NotesList({ notes, onDelete, onUpdated }) {
  const [editing, setEditing] = useState(null);

  if (!notes.length) {
    return <EmptyState message="Aún no hay notas" />;
  }

  return (
    <>
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
              {note.notifyUsers?.length ? (
                <p className="text-xs text-muted-foreground">
                  También: {note.notifyUsers.map((u) => u.name).join(', ')}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Editar"
                onClick={() => setEditing(note)}
              >
                <Pencil />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label="Eliminar"
                onClick={() => onDelete(note.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <NoteFormModal
          note={editing}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          onSaved={(updated) => {
            onUpdated?.(updated);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
