import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';
import ProjectMembersCard from '../components/projects/ProjectMembersCard';
import ProjectFinanceCard from '../components/projects/ProjectFinanceCard';
import ProjectFeaturesCard from '../components/projects/ProjectFeaturesCard';
import ProjectTasksCard from '../components/projects/ProjectTasksCard';
import ProjectStatusControls from '../components/projects/ProjectStatusControls';
import PageSkeleton from '../components/PageSkeleton';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold">{project.name}</h2>
          {user.role === 'admin' && (
            <ProjectStatusControls
              project={project}
              onUpdated={setProject}
              onDeleted={() => navigate('/projects')}
            />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{project.description}</p>
      </div>
      <ProjectMembersCard projectId={project.id} />
      {user.role === 'admin' && <ProjectTasksCard projectId={project.id} />}
      {user.role === 'admin' && <ProjectFinanceCard projectId={project.id} />}
      <ProjectFeaturesCard projectId={project.id} />
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
