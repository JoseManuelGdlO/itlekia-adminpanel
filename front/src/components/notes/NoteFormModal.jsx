import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as notesApi from '../../api/notes';
import * as notifyUsersApi from '../../api/notifyUsers';
import * as projectsApi from '../../api/projects';
import * as tasksApi from '../../api/tasks';
import NotifyUserPicker from './NotifyUserPicker';
import { joinDateTime, splitDateTime, todayInputDate } from '../../lib/localDateTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function NoteFormModal({
  projectId,
  taskId,
  onCreated,
  onSaved,
  note = null,
  open,
  onOpenChange,
}) {
  const isScoped = projectId != null || taskId != null;
  const isEdit = Boolean(note);
  const { user } = useAuth();

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dialogOpen = open ?? uncontrolledOpen;
  const setDialogOpen = onOpenChange ?? setUncontrolledOpen;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isReminder, setIsReminder] = useState(false);
  const [remindDate, setRemindDate] = useState('');
  const [remindTime, setRemindTime] = useState('09:00');
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifyUsers, setNotifyUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (dialogOpen && !isScoped && !isEdit) {
      projectsApi.listProjects().then(setProjects).catch(() => {});
      tasksApi.listTasks().then(setTasks).catch(() => {});
    }
  }, [dialogOpen, isScoped, isEdit]);

  useEffect(() => {
    if (!dialogOpen) return;
    setError('');
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setIsReminder(!!note.isReminder);
      const split = splitDateTime(note.remindAt);
      setRemindDate(split.date || todayInputDate());
      setRemindTime(split.time || '09:00');
    } else {
      setTitle('');
      setContent('');
      setIsReminder(false);
      setRemindDate(todayInputDate());
      setRemindTime('09:00');
      setLinkedProjectId('');
      setLinkedTaskId('');
      setSelectedIds([]);
    }
  }, [dialogOpen, note]);

  useEffect(() => {
    if (!isReminder) {
      setNotifyUsers([]);
      setSelectedIds([]);
      return;
    }

    const memberProjectId = projectId ?? (linkedProjectId || note?.projectId || null);
    const memberTaskId = taskId ?? (linkedTaskId || note?.taskId || null);
    let ignore = false;

    async function loadCandidates() {
      let users = [];
      if (memberProjectId) {
        users = await projectsApi.listMembers(memberProjectId);
      } else if (memberTaskId) {
        const allTasks = await tasksApi.listTasks();
        const task = allTasks.find((t) => String(t.id) === String(memberTaskId));
        if (task?.projectId) {
          users = await projectsApi.listMembers(task.projectId);
        }
      } else {
        users = await notifyUsersApi.listNotifyUsers();
      }
      if (!ignore) {
        setNotifyUsers(users.filter((u) => String(u.id) !== String(user.id)));
        if (!isEdit) setSelectedIds([]);
      }
    }

    loadCandidates().catch(() => {});
    return () => {
      ignore = true;
    };
  }, [isReminder, projectId, taskId, linkedProjectId, linkedTaskId, user.id, note, isEdit]);

  function handleToggle(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function handleProjectChange(value) {
    setLinkedProjectId(value);
    if (value) setLinkedTaskId('');
  }

  function handleTaskChange(value) {
    setLinkedTaskId(value);
    if (value) setLinkedProjectId('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      title,
      content,
      isReminder,
      remindAt: isReminder ? joinDateTime(remindDate, remindTime) : undefined,
    };
    try {
      if (isEdit) {
        const updated = await notesApi.updateNote(note.id, payload);
        onSaved?.(updated);
      } else {
        const created = await notesApi.createNote({
          ...payload,
          projectId: isScoped ? projectId : linkedProjectId || undefined,
          taskId: isScoped ? taskId : linkedTaskId || undefined,
          notifyUserIds: isReminder ? selectedIds : [],
        });
        onCreated(created);
      }
      setDialogOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo guardar');
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isEdit && <DialogTrigger render={<Button>Nueva nota</Button>} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar nota' : 'Nueva nota'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="note-title">Título</Label>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="note-content">Contenido</Label>
            <Textarea id="note-content" value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>
          {!isScoped && !isEdit && (
            <>
              <div>
                <Label htmlFor="note-project">Vincular a proyecto (opcional)</Label>
                <select
                  id="note-project"
                  value={linkedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full rounded border px-2 py-2 text-sm"
                >
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="note-task">Vincular a tarea (opcional)</Label>
                <select
                  id="note-task"
                  value={linkedTaskId}
                  onChange={(e) => handleTaskChange(e.target.value)}
                  className="w-full rounded border px-2 py-2 text-sm"
                >
                  <option value="">Sin tarea</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <input
              id="note-is-reminder"
              type="checkbox"
              checked={isReminder}
              onChange={(e) => {
                setIsReminder(e.target.checked);
                if (e.target.checked && !remindDate) setRemindDate(todayInputDate());
              }}
            />
            <Label htmlFor="note-is-reminder">Convertir en recordatorio</Label>
          </div>
          {isReminder && (
            <>
              <div>
                <Label htmlFor="note-remind-date">Fecha</Label>
                <Input
                  id="note-remind-date"
                  type="date"
                  value={remindDate}
                  onChange={(e) => setRemindDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="note-remind-time">Hora</Label>
                <Input
                  id="note-remind-time"
                  type="time"
                  value={remindTime}
                  onChange={(e) => setRemindTime(e.target.value)}
                />
              </div>
              {!isEdit && (
                <NotifyUserPicker users={notifyUsers} selectedIds={selectedIds} onToggle={handleToggle} />
              )}
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
