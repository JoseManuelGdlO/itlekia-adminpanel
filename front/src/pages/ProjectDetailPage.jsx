import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';
import ProjectMembersCard from '../components/projects/ProjectMembersCard';
import PageSkeleton from '../components/PageSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    projectsApi
      .listProjects()
      .then((projects) => {
        setProject(projects.find((p) => String(p.id) === id) || null);
      })
      .finally(() => setLoading(false));
    notesApi.listNotes({ projectId: id }).then(setNotes);
  }, [id]);

  function handleNoteCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleNoteDelete(noteId) {
    await notesApi.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (loading) return <PageSkeleton />;
  if (!project) return <div className="p-6 text-sm text-muted-foreground">No se encontró</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link to="/projects" className="text-primary hover:underline">
            Proyectos
          </Link>
          <span> / {project.name}</span>
        </p>
        <h2 className="font-heading text-xl font-semibold">{project.name}</h2>
        <p className="text-sm text-muted-foreground">{project.description}</p>
      </div>
      <ProjectMembersCard projectId={project.id} />
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notas del proyecto</CardTitle>
          <NoteFormModal projectId={project.id} onCreated={handleNoteCreated} />
        </CardHeader>
        <CardContent>
          <NotesList notes={notes} onDelete={handleNoteDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
