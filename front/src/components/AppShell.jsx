import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronsLeft,
  ChevronsRight,
  ChartColumn,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  StickyNote,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'developer'] },
  { to: '/kanban', label: 'Kanban', icon: Columns3, roles: ['admin', 'developer'] },
  { to: '/projects', label: 'Proyectos', icon: FolderKanban, roles: ['admin', 'developer'] },
  { to: '/team', label: 'Equipo', icon: ChartColumn, roles: ['admin'] },
  { to: '/users', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { to: '/notes', label: 'Notas y Recordatorios', icon: StickyNote, roles: ['admin', 'developer'] },
];

function pageTitle(pathname) {
  if (pathname.startsWith('/projects/') && pathname !== '/projects') return 'Proyecto';
  if (pathname.startsWith('/tasks/')) return 'Tarea';
  const titles = {
    '/': 'Dashboard',
    '/kanban': 'Kanban',
    '/projects': 'Proyectos',
    '/team': 'Equipo',
    '/users': 'Usuarios',
    '/notes': 'Notas y Recordatorios',
  };
  return titles[pathname] || 'Intelekia';
}

export function userInitials(name) {
  if (!name) return '?';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  );
}

function Avatar({ name }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 items-center justify-center rounded-full bg-teal-soft text-xs font-medium text-primary-foreground"
    >
      {userInitials(name)}
    </span>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Developer';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <nav
        aria-label="Principal"
        className={`flex shrink-0 flex-col bg-rail py-3 text-primary-foreground transition-[width] duration-120 ${
          expanded ? 'w-56' : 'w-12 items-center'
        }`}
      >
        <div className={`mb-4 flex items-center ${expanded ? 'justify-between px-2' : 'flex-col gap-1'}`}>
          <NavLink
            to="/"
            title="Intelekia"
            className="flex size-10 shrink-0 items-center justify-center"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-background">
              <img src="/intelekia-isotipo.png" alt="Intelekia" className="size-6 object-contain" />
            </span>
          </NavLink>
          {expanded ? (
            <p className="min-w-0 flex-1 truncate px-1 font-heading text-sm font-semibold text-primary-foreground">
              Intelekia
            </p>
          ) : null}
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Contraer menú' : 'Expandir menú'}
            title={expanded ? 'Contraer menú' : 'Expandir menú'}
            onClick={() => setExpanded((open) => !open)}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-primary-foreground/70 transition-colors duration-120 hover:text-primary-foreground"
          >
            {expanded ? <ChevronsLeft className="size-5" /> : <ChevronsRight className="size-5" />}
          </button>
        </div>
        <div className={`flex flex-1 flex-col gap-1 ${expanded ? 'px-2' : 'items-center'}`}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={expanded ? undefined : item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  `relative flex h-10 items-center rounded-lg transition-colors duration-120 ${
                    expanded ? 'gap-2 pr-2 pl-4' : 'size-10 justify-center'
                  } ${
                    isActive
                      ? 'bg-white/8 text-primary-foreground'
                      : 'text-primary-foreground/60 hover:bg-white/5 hover:text-primary-foreground'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-1/2 left-0.5 size-1.5 -translate-y-1/2 rounded-full bg-filament" />
                    )}
                    <Icon className="size-5 shrink-0" />
                    {expanded ? (
                      <span className="truncate text-sm font-medium">{item.label}</span>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
          <h1 className="font-heading text-xl font-semibold">{pageTitle(pathname)}</h1>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Avatar name={user.name} />
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Salir
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
