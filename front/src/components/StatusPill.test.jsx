import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPill from './StatusPill';

describe('StatusPill', () => {
  it.each([
    ['trabajando', 'Trabajando', 'bg-primary/12 text-primary'],
    ['parado', 'Parado', 'bg-filament/18 text-[#8a5a12]'],
    ['oculto', 'Oculto', 'bg-muted text-muted-foreground'],
    ['archivado', 'Archivado', 'bg-muted text-muted-foreground'],
  ])('labels and styles %s projects', (status, label, classes) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(label)).toHaveClass(...classes.split(' '));
  });
});
