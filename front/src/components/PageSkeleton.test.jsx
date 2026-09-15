import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageSkeleton from './PageSkeleton';

describe('PageSkeleton', () => {
  it('shows the branded loading state', () => {
    render(<PageSkeleton />);

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    expect(screen.getByText('Cargando')).toBeInTheDocument();
    expect(screen.getByAltText('Intelekia')).toBeInTheDocument();
  });
});
