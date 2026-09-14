import { useEffect, useState } from 'react';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    notesApi.listNotes().then(setNotes);
  }, []);

  function handleCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleDelete(id) {
    await notesApi.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notas y Recordatorios</h1>
        <NoteFormModal onCreated={handleCreated} />
      </div>
      <NotesList notes={notes} onDelete={handleDelete} />
    </div>
  );
}
