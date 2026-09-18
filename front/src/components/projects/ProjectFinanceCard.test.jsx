import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProjectFinanceCard from './ProjectFinanceCard';
import * as projectsApi from '../../api/projects';

const project = {
  id: 7,
  name: 'Website Revamp',
  costAmount: 12000,
  contractSignedAt: '2026-09-01',
  monthlyAmount: 1500,
  monthlyPayDay: 15,
};

describe('ProjectFinanceCard', () => {
  it('saves the finance summary fields', async () => {
    vi.spyOn(projectsApi, 'updateProject').mockResolvedValueOnce({
      ...project,
      costAmount: 8000,
      monthlyPayDay: 5,
    });
    const onSaved = vi.fn();
    render(<ProjectFinanceCard project={project} onSaved={onSaved} />);

    expect(screen.getByLabelText('Costo')).toHaveValue(12000);
    expect(screen.getByLabelText('Fecha de firma del contrato')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Pago mensual')).toHaveValue(1500);
    expect(screen.getByLabelText('Día de pago mensual')).toHaveValue(15);

    fireEvent.change(screen.getByLabelText('Costo'), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText('Día de pago mensual'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(projectsApi.updateProject).toHaveBeenCalledWith(7, {
      costAmount: 8000,
      contractSignedAt: '2026-09-01',
      monthlyAmount: 1500,
      monthlyPayDay: 5,
    }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ costAmount: 8000 }));
  });

  it('shows an error and remains usable when saving fails', async () => {
    vi.spyOn(projectsApi, 'updateProject').mockRejectedValueOnce(new Error('request failed'));
    render(<ProjectFinanceCard project={{ id: 7 }} />);

    fireEvent.change(screen.getByLabelText('Costo'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('request failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Costo')).toHaveValue(10);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });
});
