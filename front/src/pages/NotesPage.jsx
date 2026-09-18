import { useEffect, useState } from 'react';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';
import { Card, CardContent } from '@/components/ui/card';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    notesApi.listNotes().then(setNotes);
  }, []);

  function handleCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  function handleUpdated(note) {
    setNotes((prev) => prev.map((row) => (row.id === note.id ? { ...row, ...note } : row)));
  }

  async function handleDelete(id) {
    await notesApi.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-end">
        <NoteFormModal onCreated={handleCreated} />
      </div>
      <Card className="shadow-card">
        <CardContent>
          <NotesList notes={notes} onDelete={handleDelete} onUpdated={handleUpdated} />
        </CardContent>
      </Card>
    </div>
  );
}
