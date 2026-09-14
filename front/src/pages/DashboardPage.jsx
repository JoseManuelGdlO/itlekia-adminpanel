import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <p className="text-sm text-gray-600">
        {user.role === 'admin'
          ? 'Tienes acceso completo a proyectos, tareas, usuarios y notas.'
          : 'Aquí verás un resumen de tus tareas asignadas.'}
      </p>
    </div>
  );
}
