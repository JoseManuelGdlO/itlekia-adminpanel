import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';

export default function TaskDetailPage() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    tasksApi.listTasks().then((tasks) => {
      setTask(tasks.find((t) => String(t.id) === id) || null);
    });
    notesApi.listNotes({ taskId: id }).then(setNotes);
  }, [id]);

  function handleNoteCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleNoteDelete(noteId) {
    await notesApi.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (!task) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{task.title}</h1>
        <p className="text-sm text-gray-600">{task.description}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Notas de la tarea</h2>
          <NoteFormModal taskId={task.id} onCreated={handleNoteCreated} />
        </div>
        <NotesList notes={notes} onDelete={handleNoteDelete} />
      </div>
    </div>
  );
}
