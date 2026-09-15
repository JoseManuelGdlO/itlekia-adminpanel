import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProjectFinanceCard from './ProjectFinanceCard';
import * as financeApi from '../../api/finance';

describe('ProjectFinanceCard', () => {
  it('groups items and creates a cost', async () => {
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([
      { id: 1, kind: 'budget', title: 'Cap', amount: 5000, notes: '', hasFile: false },
    ]);
    vi.spyOn(financeApi, 'createFinance').mockResolvedValue({
      id: 2,
      kind: 'cost',
      title: 'Hosting',
      amount: 49.99,
      notes: 'Yearly',
      hasFile: false,
    });

    render(<ProjectFinanceCard projectId={7} />);

    await waitFor(() => expect(screen.getByText('Cap')).toBeInTheDocument());
    expect(screen.getByText('Finanzas')).toBeInTheDocument();
    expect(screen.getByText('Costos')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
    expect(screen.getByText('Presupuesto')).toBeInTheDocument();
    expect(screen.getByText('Total 5000')).toBeInTheDocument();

    const [costTitle] = screen.getAllByLabelText('Título');
    fireEvent.change(costTitle, { target: { value: 'Hosting' } });
    fireEvent.change(screen.getAllByLabelText('Monto')[0], { target: { value: '49.99' } });
    fireEvent.change(screen.getAllByLabelText('Nota')[0], { target: { value: 'Yearly' } });
    fireEvent.click(screen.getAllByText('Agregar')[0]);

    await waitFor(() => expect(financeApi.createFinance).toHaveBeenCalled());
    const fd = financeApi.createFinance.mock.calls[0][1];
    expect(fd.get('kind')).toBe('cost');
    expect(fd.get('title')).toBe('Hosting');
    expect(await screen.findByText('Hosting')).toBeInTheDocument();
  });
});
