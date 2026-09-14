import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as projectsApi from '../../api/projects';
import * as usersApi from '../../api/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectMembersCard({ projectId }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    projectsApi.listMembers(projectId).then(setMembers);
    if (isAdmin) {
      usersApi.listUsers().then(setUsers);
    }
  }, [projectId, isAdmin]);

  const available = users.filter((u) => !members.some((m) => m.id === u.id));

  async function handleAdd(e) {
    e.preventDefault();
    if (!selectedUserId) return;
    const added = await projectsApi.addMember(projectId, Number(selectedUserId));
    setMembers((prev) => [...prev, added]);
    setSelectedUserId('');
  }

  async function handleRemove(userId) {
    await projectsApi.removeMember(projectId, userId);
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Miembros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdmin && (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-md border border-input bg-card px-2 py-2 text-sm"
            >
              <option value="">Seleccionar usuario</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Button type="submit">Agregar</Button>
          </form>
        )}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin miembros</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  {isAdmin && <p className="text-xs text-muted-foreground">{m.email}</p>}
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" type="button" onClick={() => handleRemove(m.id)}>
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
