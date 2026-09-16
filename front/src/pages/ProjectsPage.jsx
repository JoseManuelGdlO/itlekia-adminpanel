import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import StatusPill from '../components/StatusPill';
import ProjectStatusControls from '../components/projects/ProjectStatusControls';

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

  function handleUpdated(updated) {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(project) {
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  }

  const openProjects = projects.filter((project) => project.status !== 'archivado');
  const archivedProjects = projects.filter((project) => project.status === 'archivado');
  const isAdmin = user.role === 'admin';

  function renderProjectsList(items) {
    return (
      <ul className="divide-y divide-border">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                {p.name}
              </Link>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={p.status} />
              {isAdmin && (
                <ProjectStatusControls project={p} onUpdated={handleUpdated} onDeleted={handleDeleted} />
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {isAdmin && (
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
        <CardContent>{renderProjectsList(openProjects)}</CardContent>
      </Card>

      {isAdmin && archivedProjects.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">Archivados</h2>
          <Card className="shadow-card">
            <CardContent>{renderProjectsList(archivedProjects)}</CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
