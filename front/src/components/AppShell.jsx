import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Columns3,
  FolderKanban,
  LayoutDashboard,
  Menu,
  StickyNote,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'developer'] },
  { to: '/kanban', label: 'Kanban', icon: Columns3, roles: ['admin', 'developer'] },
  { to: '/projects', label: 'Proyectos', icon: FolderKanban, roles: ['admin', 'developer'] },
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
      className="flex size-8 items-center justify-center rounded-full bg-teal-soft text-xs font-medium text-white"
    >
      {userInitials(name)}
    </span>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Developer';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <nav
        aria-label="Principal"
        className="flex w-12 shrink-0 flex-col items-center bg-rail py-3"
      >
        <NavLink to="/" className="mb-4 flex size-10 items-center justify-center">
          <img src="/intelekia-isotipo.png" alt="Intelekia" className="size-7 object-contain" />
        </NavLink>
        <div className="flex flex-1 flex-col items-center gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                aria-label={item.label}
                className={({ isActive }) =>
                  `relative flex size-10 items-center justify-center rounded-lg transition-colors duration-120 ${
                    isActive ? 'text-primary' : 'text-white/70 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <Icon className="size-5" />
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
        <Avatar name={user.name} />
      </nav>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-rail/40 lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-12 z-30 flex w-56 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-120 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-start justify-between px-4 pt-4">
          <div>
            <p className="font-heading text-base font-semibold text-rail">Intelekia</p>
            <p className="text-xs text-muted-foreground">Portal</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </Button>
        </div>
        <nav className="mt-4 flex-1 space-y-1 px-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-120 ${
                    isActive
                      ? 'bg-accent text-rail'
                      : 'text-foreground hover:bg-accent'
                  }`
                }
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            Salir
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Menú"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <h1 className="font-heading text-xl font-semibold">{pageTitle(pathname)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Avatar name={user.name} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
