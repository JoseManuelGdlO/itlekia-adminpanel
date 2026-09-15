import { useEffect, useState } from 'react';
import * as financeApi from '../../api/finance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SECTIONS = [
  { kind: 'cost', heading: 'Costos' },
  { kind: 'contract', heading: 'Contratos' },
  { kind: 'budget', heading: 'Presupuesto' },
];

const EMPTY_FORM = { title: '', amount: '', notes: '', file: null };

export default function ProjectFinanceCard({ projectId }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [forms, setForms] = useState(() =>
    Object.fromEntries(SECTIONS.map(({ kind }) => [kind, { ...EMPTY_FORM }]))
  );

  useEffect(() => {
    let ignore = false;
    setItems([]);
    setError('');

    financeApi.listFinance(projectId).then((data) => {
      if (!ignore) setItems(data);
    });

    return () => {
      ignore = true;
    };
  }, [projectId]);

  function updateForm(kind, field, value) {
    setForms((current) => ({
      ...current,
      [kind]: { ...current[kind], [field]: value },
    }));
  }

  async function handleAdd(event, kind) {
    event.preventDefault();
    setError('');
    const form = forms[kind];
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('title', form.title);
    formData.append('amount', form.amount);
    formData.append('notes', form.notes);
    if (form.file) formData.append('file', form.file);

    try {
      const created = await financeApi.createFinance(projectId, formData);
      setItems((current) => [...current, created]);
      setForms((current) => ({ ...current, [kind]: { ...EMPTY_FORM } }));
    } catch {
      setError('No se pudo guardar');
    }
  }

  async function handleDelete(itemId) {
    setError('');
    try {
      await financeApi.deleteFinance(projectId, itemId);
      setItems((current) => current.filter((item) => item.id !== itemId));
    } catch {
      setError('No se pudo quitar');
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Finanzas</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
        {SECTIONS.map(({ kind, heading }) => {
          const sectionItems = items.filter((item) => item.kind === kind);
          const total = sectionItems.reduce((sum, item) => sum + Number(item.amount), 0);
          const form = forms[kind];

          return (
            <section key={kind} className="space-y-3">
              <h3 className="font-heading text-sm font-semibold">{heading}</h3>
              <form onSubmit={(event) => handleAdd(event, kind)} className="space-y-2">
                <label className="block text-xs" htmlFor={`finance-title-${kind}`}>
                  Título
                </label>
                <input
                  id={`finance-title-${kind}`}
                  required
                  value={form.title}
                  onChange={(event) => updateForm(kind, 'title', event.target.value)}
                  className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                />
                <label className="block text-xs" htmlFor={`finance-amount-${kind}`}>
                  Monto
                </label>
                <input
                  id={`finance-amount-${kind}`}
                  type="number"
                  step="any"
                  required
                  value={form.amount}
                  onChange={(event) => updateForm(kind, 'amount', event.target.value)}
                  className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                />
                <label className="block text-xs" htmlFor={`finance-notes-${kind}`}>
                  Nota
                </label>
                <input
                  id={`finance-notes-${kind}`}
                  value={form.notes}
                  onChange={(event) => updateForm(kind, 'notes', event.target.value)}
                  className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                />
                <label className="block text-xs" htmlFor={`finance-file-${kind}`}>
                  Archivo
                </label>
                <input
                  id={`finance-file-${kind}`}
                  type="file"
                  onChange={(event) => updateForm(kind, 'file', event.target.files[0] || null)}
                  className="block w-full text-xs"
                />
                <Button type="submit">Agregar</Button>
              </form>

              {sectionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin partidas</p>
              ) : (
                <ul className="divide-y divide-border">
                  {sectionItems.map((item) => (
                    <li key={item.id} className="space-y-1 py-2">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.amount}</p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {item.hasFile && (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() =>
                              financeApi.downloadFinanceFile(
                                projectId,
                                item.id,
                                item.fileName
                              )
                            }
                          >
                            Descargar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => handleDelete(item.id)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {kind === 'budget' && <p className="text-sm font-medium">Total {String(total)}</p>}
            </section>
          );
        })}
        </div>
      </CardContent>
    </Card>
  );
}
