import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskDescriptionEditor from './TaskDescriptionEditor';

describe('TaskDescriptionEditor', () => {
  it('exposes H1, H2, and H3 heading controls', () => {
    render(<TaskDescriptionEditor value="" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H3' })).toBeInTheDocument();
  });
});
