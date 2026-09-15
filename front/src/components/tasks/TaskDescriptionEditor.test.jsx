import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getSchema } from '@tiptap/react';
import TaskDescriptionEditor, { buildTaskDescriptionExtensions } from './TaskDescriptionEditor';

describe('TaskDescriptionEditor', () => {
  it('exposes H1, H2, and H3 heading controls', async () => {
    render(<TaskDescriptionEditor value="" onChange={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H3' })).toBeInTheDocument();
  });

  it('styles the editable content with the shared task description class', async () => {
    const { container } = render(<TaskDescriptionEditor value="" onChange={vi.fn()} />);

    await screen.findByRole('button', { name: 'H1' });
    expect(container.querySelector('[aria-label="Descripción"]')).toHaveClass(
      'task-description-html'
    );
  });

  it('exposes labeled toolbar buttons so formatting can be selected', async () => {
    render(<TaskDescriptionEditor value="" onChange={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Negrita' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cursiva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subrayado' })).toBeInTheDocument();
  });

  it('does not emit onChange when the parent pushes a new value', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TaskDescriptionEditor value="<p>uno</p>" onChange={onChange} />
    );
    await screen.findByRole('button', { name: 'H1' });
    onChange.mockClear();

    rerender(<TaskDescriptionEditor value="<p>dos</p>" onChange={onChange} />);

    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).toHaveTextContent('dos');
    });
    expect(onChange).not.toHaveBeenCalled();
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
