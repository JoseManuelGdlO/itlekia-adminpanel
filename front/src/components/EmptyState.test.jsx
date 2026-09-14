import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders the empty copy and optional action', () => {
    render(<EmptyState message="Aún no hay notas" action={<button type="button">Nueva nota</button>} />);
    expect(screen.getByText('Aún no hay notas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva nota' })).toBeInTheDocument();
  });
});
