import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPill from './StatusPill';

describe('StatusPill', () => {
  it('labels active as Activo and archived as Archivado', () => {
    const { rerender } = render(<StatusPill status="active" />);
    expect(screen.getByText('Activo')).toBeInTheDocument();
    rerender(<StatusPill status="archived" />);
    expect(screen.getByText('Archivado')).toBeInTheDocument();
  });
});
