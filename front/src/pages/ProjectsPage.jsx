import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    projectsApi.listProjects().then(setProjects);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const created = await projectsApi.createProject({ name, description });
    setProjects((prev) => [...prev, created]);
    setName('');
    setDescription('');
  }

  async function handleArchive(project) {
    const updated = await projectsApi.updateProject(project.id, {
      status: project.status === 'active' ? 'archived' : 'active',
    });
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Proyectos</h1>

      {user.role === 'admin' && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit">Crear proyecto</Button>
        </form>
      )}

      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <Link to={`/projects/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <p className="text-sm text-gray-600">{p.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-gray-500">{p.status}</span>
              {user.role === 'admin' && (
                <Button size="sm" variant="outline" onClick={() => handleArchive(p)}>
                  {p.status === 'active' ? 'Archivar' : 'Reactivar'}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
