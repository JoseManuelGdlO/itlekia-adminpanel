import { useEffect, useState } from 'react';
import * as usersApi from '../api/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'developer' });

  useEffect(() => {
    usersApi.listUsers().then(setUsers);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const created = await usersApi.createUser(form);
    setUsers((prev) => [...prev, created]);
    setForm({ name: '', email: '', password: '', role: 'developer' });
  }

  async function handleDelete(id) {
    await usersApi.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-card">
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded-md border border-input bg-card px-2 py-2 text-sm"
            >
              <option value="developer">Developer</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit">Crear usuario</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent>
          <table className="w-full text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2">
            <thead className="bg-background text-left text-xs text-muted-foreground">
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
