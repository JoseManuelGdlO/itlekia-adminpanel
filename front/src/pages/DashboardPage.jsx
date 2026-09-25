import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as dashboardApi from '../api/dashboard';
import { dashboardItemHref } from '../lib/dashboardItemHref';
import { Card, CardContent } from '@/components/ui/card';
import StatusPill from '../components/StatusPill';
import PageSkeleton from '../components/PageSkeleton';
import EmptyState from '../components/EmptyState';

const PULSE = [
  { key: 'overdue', label: 'Vencidas' },
  { key: 'today', label: 'Hoy' },
  { key: 'remindersToday', label: 'Recordatorios' },
  { key: 'paused', label: 'Parados' },
];

const TYPE_LABEL = {
  task: 'Tarea',
  note_reminder: 'Recordatorio',
  feature_reminder: 'Feature',
  project: 'Parado',
};

function itemDate(item) {
  if (!item.at) return null;
  return new Date(item.at).toLocaleDateString('es-MX');
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    dashboardApi
      .getDashboard()
      .then((payload) => {
        if (ignore) return;
        setData(payload);
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
      <div className="space-y-6 p-6">
        <div>
          <p className="font-heading text-2xl font-semibold">Hola, {user.name}</p>
          <p className="text-sm text-muted-foreground">Vencidas y para hoy, más proyectos parados.</p>
        </div>
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

  const pulse = data?.pulse || { overdue: 0, today: 0, remindersToday: 0, paused: 0 };
  const items = data?.items || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="font-heading text-2xl font-semibold">Hola, {user.name}</p>
        <p className="text-sm text-muted-foreground">Vencidas y para hoy, más proyectos parados.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PULSE.map((card) => (
          <Card key={card.key} className="shadow-card">
            <CardContent className="space-y-2 pt-0">
              <p className="font-mono text-[2rem] leading-none tracking-tight">{pulse[card.key]}</p>
              <p className="text-[0.68rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {card.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent>
          {items.length === 0 ? (
            <EmptyState message="Nada vencido ni para hoy" />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const date = itemDate(item);
                return (
                  <li key={`${item.kind}-${item.id}`} className="py-3">
                    <Link
                      to={dashboardItemHref(item)}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.kind === 'project' ? (
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{TYPE_LABEL.project}</span>
                        <StatusPill status="parado" />
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span>{TYPE_LABEL[item.kind]}</span>
                        {item.projectName ? <span> · {item.projectName}</span> : null}
                        {date ? (
                          <>
                            <span> · </span>
                            <span className={item.bucket === 'overdue' ? 'text-destructive' : undefined}>
                              {date}
                            </span>
                          </>
                        ) : null}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
