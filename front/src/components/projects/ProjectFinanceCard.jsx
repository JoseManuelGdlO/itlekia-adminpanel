import { useEffect, useState } from 'react';
import * as projectsApi from '../../api/projects';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function moneyValue(value) {
  return value == null || value === '' ? '' : String(value);
}

export default function ProjectFinanceCard({ project, onSaved }) {
  const [costAmount, setCostAmount] = useState(moneyValue(project?.costAmount));
  const [contractSignedAt, setContractSignedAt] = useState(project?.contractSignedAt || '');
  const [monthlyAmount, setMonthlyAmount] = useState(moneyValue(project?.monthlyAmount));
  const [monthlyPayDay, setMonthlyPayDay] = useState(
    project?.monthlyPayDay == null ? '' : String(project.monthlyPayDay)
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCostAmount(moneyValue(project?.costAmount));
    setContractSignedAt(project?.contractSignedAt || '');
    setMonthlyAmount(moneyValue(project?.monthlyAmount));
    setMonthlyPayDay(project?.monthlyPayDay == null ? '' : String(project.monthlyPayDay));
    setError('');
  }, [project?.id, project?.costAmount, project?.contractSignedAt, project?.monthlyAmount, project?.monthlyPayDay]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const saved = await projectsApi.updateProject(project.id, {
        costAmount: costAmount === '' ? null : Number(costAmount),
        contractSignedAt: contractSignedAt || null,
        monthlyAmount: monthlyAmount === '' ? null : Number(monthlyAmount),
        monthlyPayDay: monthlyPayDay === '' ? null : Number(monthlyPayDay),
      });
      onSaved?.(saved);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
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
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="finance-cost">Costo</Label>
            <Input
              id="finance-cost"
              type="number"
              min="0"
              step="any"
              value={costAmount}
              onChange={(event) => setCostAmount(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="finance-signed">Fecha de firma del contrato</Label>
            <Input
              id="finance-signed"
              type="date"
              value={contractSignedAt}
              onChange={(event) => setContractSignedAt(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="finance-monthly">Pago mensual</Label>
            <Input
              id="finance-monthly"
              type="number"
              min="0"
              step="any"
              value={monthlyAmount}
              onChange={(event) => setMonthlyAmount(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="finance-payday">Día de pago mensual</Label>
            <Input
              id="finance-payday"
              type="number"
              min="1"
              max="31"
              value={monthlyPayDay}
              onChange={(event) => setMonthlyPayDay(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
