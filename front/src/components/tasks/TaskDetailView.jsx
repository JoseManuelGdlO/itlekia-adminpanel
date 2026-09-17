import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as tasksApi from '../../api/tasks';
import * as notesApi from '../../api/notes';
import * as projectsApi from '../../api/projects';
import NotesList from '../notes/NotesList';
import NoteFormModal from '../notes/NoteFormModal';
import PageSkeleton from '../PageSkeleton';
import TaskDescriptionEditor from './TaskDescriptionEditor';
import { useAuth } from '../../context/AuthContext';
import { sanitizeTaskHtml } from '../../lib/sanitizeTaskHtml';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function formatActivity(item) {
  const name = item.user?.name || 'Alguien';
  if (item.type === 'created') {
    return `${name} creó la tarea`;
  }
  if (item.type === 'assignee_changed') {
    return `${name} asignó ${item.fromStatus || 'Sin asignar'} → ${item.toStatus || 'Sin asignar'}`;
  }
  return `${name} movió ${item.fromStatus} → ${item.toStatus}`;
}

export default function TaskDetailView({ taskId, embedded = false, onDeleted }) {
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canAssign = user?.role === 'admin';

  useEffect(() => {
    setLoading(true);
    tasksApi
      .listTasks()
      .then((tasks) => {
        const loadedTask = tasks.find((t) => String(t.id) === String(taskId)) || null;
        setTask(loadedTask);
        setDescription(loadedTask?.description || '');
        setAssigneeId(loadedTask?.assigneeId ?? '');
        if (loadedTask?.projectId) {
          projectsApi.listMembers(loadedTask.projectId).then(setMembers).catch(() => setMembers([]));
        }
      })
      .finally(() => setLoading(false));
    notesApi.listNotes({ taskId }).then(setNotes).catch(() => setNotes([]));
    tasksApi.listTaskActivities(taskId).then(setActivities).catch(() => setActivities([]));
  }, [taskId]);

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
      const saved = await tasksApi.updateTask(task.id, { description });
      setTask((previous) => ({ ...previous, ...saved, description: saved.description ?? description }));
    } catch (err) {
      setDescription(task.description || '');
      setError(err.response?.data?.error || err.message);
    }
  }

  async function handleAssigneeChange(nextId) {
    setAssigneeId(nextId);
    setError('');
    try {
      const saved = await tasksApi.updateTask(task.id, { assigneeId: nextId === '' ? null : Number(nextId) });
      setTask((previous) => ({ ...previous, ...saved }));
      const nextActivities = await tasksApi.listTaskActivities(task.id);
      setActivities(nextActivities);
    } catch (err) {
      setAssigneeId(task.assigneeId ?? '');
      setError(err.response?.data?.error || err.message);
    }
  }

  async function handleDelete() {
    setError('');
    try {
      await tasksApi.deleteTask(task.id);
      onDeleted?.(task);
      setDeleteOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  if (loading) return <PageSkeleton />;
  if (!task) return <div className="text-sm text-muted-foreground">No se encontró</div>;

  const canEditDescription =
    user?.role === 'admin' || String(user?.id) === String(task.assigneeId);
  const canDelete = user?.role === 'admin';
  const assigneeName =
    members.find((member) => String(member.id) === String(task.assigneeId))?.name || 'Sin asignar';

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6 p-6'}>
      <div>
        {!embedded && (
          <>
            <p className="text-xs text-muted-foreground">
              <Link to="/kanban" className="text-primary hover:underline">
                Kanban
              </Link>
              <span> / {task.title}</span>
            </p>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-semibold">{task.title}</h2>
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Eliminar
                </Button>
              )}
            </div>
          </>
        )}
        {embedded && canDelete && (
          <div className="flex justify-end">
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              Eliminar
            </Button>
          </div>
        )}
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
        {canAssign ? (
          <div className="mt-3 space-y-1">
            <Label htmlFor="assignee">Asignar a</Label>
            <select
              id="assignee"
              value={assigneeId === null || assigneeId === undefined ? '' : String(assigneeId)}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full rounded border px-2 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Asignado a: {assigneeName}</p>
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
      {canDelete && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar</DialogTitle>
            </DialogHeader>
            <p>¿Eliminar {task.title}? Se borran notas e historial de la tarea.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
