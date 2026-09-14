import { useState } from 'react';
import * as notesApi from '../../api/notes';
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isReminder, setIsReminder] = useState(false);
  const [remindAt, setRemindAt] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const created = await notesApi.createNote({
      title,
      content,
      projectId,
      taskId,
      isReminder,
      remindAt: isReminder ? remindAt : undefined,
    });
    onCreated(created);
    setOpen(false);
    setTitle('');
    setContent('');
    setIsReminder(false);
    setRemindAt('');
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
