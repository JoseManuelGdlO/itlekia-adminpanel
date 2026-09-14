import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import StatusPill from '../components/StatusPill';

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
    <div className="space-y-6 p-6">
      {user.role === 'admin' && (
        <form onSubmit={handleCreate}>
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-end gap-2">
              <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button type="submit">Crear proyecto</Button>
            </CardContent>
          </Card>
        </form>
      )}

      <Card className="shadow-card">
        <CardContent>
          <ul className="divide-y divide-border">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={p.status} />
                  {user.role === 'admin' && (
                    <Button size="sm" variant="outline" onClick={() => handleArchive(p)}>
                      {p.status === 'active' ? 'Archivar' : 'Reactivar'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
