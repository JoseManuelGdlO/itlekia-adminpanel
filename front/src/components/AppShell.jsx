import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'developer'] },
  { to: '/kanban', label: 'Kanban', roles: ['admin', 'developer'] },
  { to: '/projects', label: 'Proyectos', roles: ['admin', 'developer'] },
  { to: '/users', label: 'Usuarios', roles: ['admin'] },
  { to: '/notes', label: 'Notas y Recordatorios', roles: ['admin', 'developer'] },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4 space-y-2">
        <p className="mb-4 font-semibold">Portal Admin</p>
        {NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded px-2 py-1 text-sm ${isActive ? 'bg-gray-200' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <Button variant="outline" className="mt-4 w-full" onClick={() => logout()}>
          Logout
        </Button>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
