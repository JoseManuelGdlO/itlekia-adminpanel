import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotifyUserPicker from './NotifyUserPicker';

describe('NotifyUserPicker', () => {
  it('calls onToggle with the clicked user id', () => {
    const onToggle = vi.fn();

    render(
      <NotifyUserPicker
        users={[
          { id: 2, name: 'Ada' },
          { id: 3, name: 'Luis' },
        ]}
        selectedIds={[]}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByLabelText('Ada'));

    expect(onToggle).toHaveBeenCalledWith(2);
  });
});
