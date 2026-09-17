import { useRef, useState } from 'react';
import * as tasksApi from '../../api/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TaskDescriptionEditor from '../tasks/TaskDescriptionEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function TaskFormModal({ projectId, users, onCreated }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const createInFlightRef = useRef(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setConfirmOpen(true);
  }

  async function handleCreate() {
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    setPending(true);
    setError('');
    let created;
    try {
      created = await tasksApi.createTask({
        projectId,
        title,
        description,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
    } catch (err) {
      setConfirmOpen(false);
      setError(err.response?.data?.error || err.message);
      return;
    } finally {
      createInFlightRef.current = false;
      setPending(false);
    }
    setConfirmOpen(false);
    setOpen(false);
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setDueDate('');
    onCreated(created);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button>Nueva tarea</Button>} />
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>Descripción</Label>
              <TaskDescriptionEditor value={description} onChange={setDescription} />
            </div>
            <div>
              <Label htmlFor="assignee">Asignar a</Label>
              <select
                id="assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded border px-2 py-2 text-sm"
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="dueDate">Fecha límite</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending}>Guardar</Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear</DialogTitle>
          </DialogHeader>
          <p>¿Crear {title}?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={handleCreate}>
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
