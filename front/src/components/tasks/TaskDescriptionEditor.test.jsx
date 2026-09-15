import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getSchema } from '@tiptap/react';
import TaskDescriptionEditor, { buildTaskDescriptionExtensions } from './TaskDescriptionEditor';

describe('TaskDescriptionEditor', () => {
  it('exposes H1, H2, and H3 heading controls', () => {
    render(<TaskDescriptionEditor value="" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H3' })).toBeInTheDocument();
  });

  it('styles the editable content with the shared task description class', () => {
    const { container } = render(<TaskDescriptionEditor value="" onChange={vi.fn()} />);

    expect(container.querySelector('[aria-label="Descripción"]')).toHaveClass(
      'task-description-html'
    );
  });

  it('keeps the schema limited to the allowlisted nodes and marks', () => {
    const schema = getSchema(buildTaskDescriptionExtensions());

    expect(Object.keys(schema.nodes)).toEqual(
      expect.arrayContaining(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem'])
    );
    for (const node of ['blockquote', 'codeBlock', 'horizontalRule']) {
      expect(schema.nodes[node]).toBeUndefined();
    }
    for (const mark of ['code', 'strike']) {
      expect(schema.marks[mark]).toBeUndefined();
    }
  });
});
