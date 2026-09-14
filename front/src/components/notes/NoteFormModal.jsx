import { useEffect, useState } from 'react';
import * as notesApi from '../../api/notes';
import * as projectsApi from '../../api/projects';
import * as tasksApi from '../../api/tasks';
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

export default function NoteFormModal({ projectId, taskId, onCreated }) {
  // When the caller already scopes this modal to a project or task (e.g. from
  // ProjectDetailPage/TaskDetailPage), keep the existing fixed behavior and
  // never show a picker. The picker only appears on the standalone Notes page.
  const isScoped = projectId != null || taskId != null;

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isReminder, setIsReminder] = useState(false);
  const [remindAt, setRemindAt] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  // Fetch the project/task lists lazily, only when the dialog is opened and
  // only when there's an actual picker to fill in.
  useEffect(() => {
    if (open && !isScoped) {
      projectsApi.listProjects().then(setProjects).catch(() => {});
      tasksApi.listTasks().then(setTasks).catch(() => {});
    }
  }, [open, isScoped]);

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
    const created = await notesApi.createNote({
      title,
      content,
      projectId: isScoped ? projectId : linkedProjectId || undefined,
      taskId: isScoped ? taskId : linkedTaskId || undefined,
      isReminder,
      remindAt: isReminder ? remindAt : undefined,
    });
    onCreated(created);
    setOpen(false);
    setTitle('');
    setContent('');
    setIsReminder(false);
    setRemindAt('');
    setLinkedProjectId('');
    setLinkedTaskId('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Nueva nota</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva nota</DialogTitle>
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
          {!isScoped && (
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
              onChange={(e) => setIsReminder(e.target.checked)}
            />
            <Label htmlFor="note-is-reminder">Convertir en recordatorio</Label>
          </div>
          {isReminder && (
            <div>
              <Label htmlFor="note-remind-at">Fecha y hora</Label>
              <Input
                id="note-remind-at"
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                required
              />
            </div>
          )}
          <Button type="submit">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
