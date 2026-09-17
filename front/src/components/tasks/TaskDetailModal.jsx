import TaskDetailView from './TaskDetailView';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function TaskDetailModal({ task, onClose, onDeleted }) {
  const open = task != null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{task?.title || 'Tarea'}</DialogTitle>
        </DialogHeader>
        {open && <TaskDetailView taskId={task.id} embedded onDeleted={onDeleted} />}
      </DialogContent>
    </Dialog>
  );
}
