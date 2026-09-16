import { Link } from 'react-router-dom';
import { Columns3, FolderKanban, StickyNote, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';

const TILES = [
  { to: '/kanban', label: 'Kanban', description: 'Tablero de tareas y estados.', icon: Columns3 },
  { to: '/projects', label: 'Proyectos', description: 'Proyectos por estado.', icon: FolderKanban },
  { to: '/notes', label: 'Notas y Recordatorios', description: 'Notas sueltas y recordatorios.', icon: StickyNote },
  { to: '/users', label: 'Usuarios', description: 'Cuentas de admin y developers.', icon: Users, roles: ['admin'] },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const tiles = TILES.filter((tile) => !tile.roles || tile.roles.includes(user.role));

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="font-heading text-2xl font-semibold">Hola, {user.name}</p>
        <p className="text-sm text-muted-foreground">
          {user.role === 'admin'
            ? 'Tienes acceso completo a proyectos, tareas, usuarios y notas.'
            : 'Aquí verás un resumen de tus tareas asignadas.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.to} to={tile.to}>
              <Card className="h-full shadow-card transition-colors duration-120 hover:bg-accent">
                <CardContent className="space-y-2 pt-0">
                  <Icon className="size-5 text-primary" />
                  <p className="font-heading font-semibold">{tile.label}</p>
                  <p className="text-xs text-muted-foreground">{tile.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
