import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';
import PageSkeleton from '../components/PageSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

function formatActivity(item) {
  if (item.type === 'created') {
    return `${item.user.name} creó la tarea`;
  }
  const fromLabel = STATUS_LABELS[item.fromStatus] || item.fromStatus;
  const toLabel = STATUS_LABELS[item.toStatus] || item.toStatus;
  return `${item.user.name} movió ${fromLabel} → ${toLabel}`;
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    tasksApi
      .listTasks()
      .then((tasks) => {
        setTask(tasks.find((t) => String(t.id) === id) || null);
      })
      .finally(() => setLoading(false));
    notesApi.listNotes({ taskId: id }).then(setNotes);
    tasksApi.listTaskActivities(id).then(setActivities);
  }, [id]);

  function handleNoteCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleNoteDelete(noteId) {
    await notesApi.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (loading) return <PageSkeleton />;
  if (!task) return <div className="p-6 text-sm text-muted-foreground">No se encontró</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link to="/kanban" className="text-primary hover:underline">
            Kanban
          </Link>
          <span> / {task.title}</span>
        </p>
        <h2 className="font-heading text-xl font-semibold">{task.title}</h2>
        <p className="text-sm text-muted-foreground">{task.description}</p>
      </div>
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notas de la tarea</CardTitle>
          <NoteFormModal taskId={task.id} onCreated={handleNoteCreated} />
        </CardHeader>
        <CardContent>
          <NotesList notes={notes} onDelete={handleNoteDelete} />
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activities.map((item) => (
                <li key={item.id}>{formatActivity(item)}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
