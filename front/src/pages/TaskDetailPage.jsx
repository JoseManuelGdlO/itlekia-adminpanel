import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as tasksApi from '../api/tasks';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';
import PageSkeleton from '../components/PageSkeleton';
import TaskDescriptionEditor from '../components/tasks/TaskDescriptionEditor';
import { useAuth } from '../context/AuthContext';
import { sanitizeTaskHtml } from '../lib/sanitizeTaskHtml';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatActivity(item) {
  if (item.type === 'created') {
    return `${item.user.name} creó la tarea`;
  }
  return `${item.user.name} movió ${item.fromStatus} → ${item.toStatus}`;
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    tasksApi
      .listTasks()
      .then((tasks) => {
        const loadedTask = tasks.find((t) => String(t.id) === id) || null;
        setTask(loadedTask);
        setDescription(loadedTask?.description || '');
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

  async function handleDescriptionSave() {
    setError('');
    try {
      await tasksApi.updateTask(task.id, { description });
      setTask((previous) => ({ ...previous, description }));
    } catch (err) {
      setDescription(task.description || '');
      setError(err.response?.data?.error || err.message);
    }
  }

  if (loading) return <PageSkeleton />;
  if (!task) return <div className="p-6 text-sm text-muted-foreground">No se encontró</div>;

  const canEditDescription =
    user?.role === 'admin' || String(user?.id) === String(task.assigneeId);

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
        {canEditDescription ? (
          <div className="space-y-2">
            <TaskDescriptionEditor value={description} onChange={setDescription} />
            <Button type="button" onClick={handleDescriptionSave}>Guardar</Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div
            className="task-description-html text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeTaskHtml(task.description) }}
          />
        )}
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
