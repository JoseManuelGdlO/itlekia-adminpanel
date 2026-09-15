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

  it('requires a title and amount for every finance form', async () => {
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);

    render(<ProjectFinanceCard projectId={7} />);

    await waitFor(() => expect(financeApi.listFinance).toHaveBeenCalledWith(7));
    screen.getAllByLabelText('Título').forEach((input) => expect(input).toBeRequired());
    screen.getAllByLabelText('Monto').forEach((input) => expect(input).toBeRequired());
  });

  it('shows an error and remains usable when creating an item fails', async () => {
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([]);
    vi.spyOn(financeApi, 'createFinance').mockRejectedValueOnce(new Error('request failed'));

    render(<ProjectFinanceCard projectId={7} />);

    const [costTitle] = screen.getAllByLabelText('Título');
    const [costAmount] = screen.getAllByLabelText('Monto');
    fireEvent.change(costTitle, { target: { value: 'Hosting' } });
    fireEvent.change(costAmount, { target: { value: '49.99' } });
    fireEvent.click(screen.getAllByText('Agregar')[0]);

    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(costTitle).toHaveValue('Hosting');
    expect(costAmount).toHaveValue(49.99);
    expect(screen.getAllByText('Agregar')[0]).toBeEnabled();
  });

  it('shows an error and keeps the item when deleting fails', async () => {
    vi.spyOn(financeApi, 'listFinance').mockResolvedValue([
      { id: 1, kind: 'cost', title: 'Hosting', amount: 49.99, notes: '', hasFile: false },
    ]);
    vi.spyOn(financeApi, 'deleteFinance').mockRejectedValueOnce(new Error('request failed'));

    render(<ProjectFinanceCard projectId={7} />);

    await screen.findByText('Hosting');
    fireEvent.click(screen.getByText('Quitar'));

    expect(await screen.findByText('No se pudo quitar')).toBeInTheDocument();
    expect(screen.getByText('Hosting')).toBeInTheDocument();
  });
});
