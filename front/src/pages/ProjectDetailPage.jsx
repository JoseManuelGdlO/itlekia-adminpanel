import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    projectsApi.listProjects().then((projects) => {
      setProject(projects.find((p) => String(p.id) === id) || null);
    });
    notesApi.listNotes({ projectId: id }).then(setNotes);
  }, [id]);

  function handleNoteCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleNoteDelete(noteId) {
    await notesApi.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (!project) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-gray-600">{project.description}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Notas del proyecto</h2>
          <NoteFormModal projectId={project.id} onCreated={handleNoteCreated} />
        </div>
        <NotesList notes={notes} onDelete={handleNoteDelete} />
      </div>
    </div>
  );
}
