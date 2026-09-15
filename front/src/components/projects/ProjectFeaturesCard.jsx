import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as featuresApi from '../../api/features';
import * as projectsApi from '../../api/projects';
import NotifyUserPicker from '../notes/NotifyUserPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'pending',
  isReminder: false,
  remindAt: '',
};

export default function ProjectFeaturesCard({ projectId }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [features, setFeatures] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notifyUsers, setNotifyUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    let ignore = false;
    setFeatures([]);

    featuresApi.listFeatures(projectId).then((data) => {
      if (!ignore) setFeatures(data);
    });

    return () => {
      ignore = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!form.isReminder) {
      setNotifyUsers([]);
      setSelectedIds([]);
      return;
    }

    let ignore = false;
    projectsApi
      .listMembers(projectId)
      .then((data) => {
        if (!ignore) {
          setNotifyUsers(data.filter((u) => String(u.id) !== String(user.id)));
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [form.isReminder, projectId, user.id]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const created = await featuresApi.createFeature(projectId, {
      title: form.title,
      description: form.description,
      status: form.status,
      isReminder: form.isReminder,
      remindAt: form.isReminder ? form.remindAt : undefined,
      notifyUserIds: form.isReminder ? selectedIds : [],
    });
    setFeatures((current) => [...current, created]);
    setForm(EMPTY_FORM);
    setSelectedIds([]);
    setNotifyUsers([]);
    setOpen(false);
  }

  function handleToggle(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  async function handleDelete(featureId) {
    await featuresApi.deleteFeature(projectId, featureId);
    setFeatures((current) => current.filter((feature) => feature.id !== featureId));
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Features</CardTitle>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>Nuevo feature</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo feature</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="feature-title">Título</Label>
                  <Input
                    id="feature-title"
                    value={form.title}
                    onChange={(event) => updateForm('title', event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="feature-description">Descripción</Label>
                  <Textarea
                    id="feature-description"
                    value={form.description}
                    onChange={(event) => updateForm('description', event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="feature-status">Estado</Label>
                  <select
                    id="feature-status"
                    value={form.status}
                    onChange={(event) => updateForm('status', event.target.value)}
                    className="w-full rounded border px-2 py-2 text-sm"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="done">Hecho</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="feature-is-reminder"
                    type="checkbox"
                    checked={form.isReminder}
                    onChange={(event) => updateForm('isReminder', event.target.checked)}
                  />
                  <Label htmlFor="feature-is-reminder">Recordatorio</Label>
                </div>
                {form.isReminder && (
                  <>
                    <div>
                      <Label htmlFor="feature-remind-at">Fecha y hora</Label>
                      <Input
                        id="feature-remind-at"
                        type="datetime-local"
                        value={form.remindAt}
                        onChange={(event) => updateForm('remindAt', event.target.value)}
                        required
                      />
                    </div>
                    <NotifyUserPicker
                      users={notifyUsers}
                      selectedIds={selectedIds}
                      onToggle={handleToggle}
                    />
                  </>
                )}
                <Button type="submit">Guardar</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {features.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin features</p>
        ) : (
          <ul className="divide-y divide-border">
            {features.map((feature) => (
              <li
                key={feature.id}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{feature.title}</p>
                  {feature.description && (
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {feature.status === 'done' ? 'Hecho' : 'Pendiente'}
                  </p>
                  {feature.notifyUsers?.length ? (
                    <p className="text-xs text-muted-foreground">
                      También: {feature.notifyUsers.map((u) => u.name).join(', ')}
                    </p>
                  ) : null}
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => handleDelete(feature.id)}
                  >
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
