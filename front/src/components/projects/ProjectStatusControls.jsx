import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import * as projectsApi from '../../api/projects';
import { PROJECT_STATUS_OPTIONS } from '../../lib/projectStatus';

export default function ProjectStatusControls({ project, onUpdated, onDeleted }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleStatusChange(e) {
    const updated = await projectsApi.updateProject(project.id, { status: e.target.value });
    onUpdated(updated);
  }

  async function handleDelete() {
    await projectsApi.deleteProject(project.id);
    onDeleted(project);
    setDeleteOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Estado"
        value={project.status}
        onChange={handleStatusChange}
        className="rounded border px-2 py-1 text-sm"
      >
        {PROJECT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
        Eliminar
      </Button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar</DialogTitle>
          </DialogHeader>
          <p>¿Eliminar {project.name}? Se borran tareas, notas, features y finanzas.</p>
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
    </div>
  );
}
