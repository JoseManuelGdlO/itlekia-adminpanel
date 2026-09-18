import { useEffect, useState } from 'react';
import * as statsApi from '../api/stats';
import { Card, CardContent } from '@/components/ui/card';
import PageSkeleton from '../components/PageSkeleton';
import EmptyState from '../components/EmptyState';

export default function TeamPage() {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    statsApi
      .getTeamStats()
      .then((payload) => {
        if (ignore) return;
        setMembers(payload.members || []);
        setError('');
      })
      .catch(() => {
        if (!ignore) setError('No se pudo cargar');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <PageSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }
  if (!members.length) {
    return (
      <div className="p-6">
        <EmptyState message="Nadie en el equipo" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="shadow-card">
        <CardContent>
          <table className="w-full text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2">
            <thead className="bg-background text-left text-xs text-muted-foreground">
              <tr>
                <th>Nombre</th>
                <th>Proyectos</th>
                <th>Por hacer</th>
                <th>En curso</th>
                <th>Hechas</th>
                <th>Horas est.</th>
              </tr>
            </thead>
            <tbody>
              {members.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td>{row.name}</td>
                  <td>{row.projects}</td>
                  <td>{row.todo}</td>
                  <td>{row.inProgress}</td>
                  <td>{row.done}</td>
                  <td>{row.estimatedHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
