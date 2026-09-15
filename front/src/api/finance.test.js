import { afterEach, describe, expect, it, vi } from 'vitest';
import api from './client';
import { downloadFinanceFile } from './finance';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('downloadFinanceFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('downloads the blob and revokes its URL asynchronously', async () => {
    vi.useFakeTimers();
    const blob = new Blob(['invoice']);
    api.get.mockResolvedValue({ data: blob });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadFinanceFile(7, 3, 'invoice.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a[download="invoice.pdf"]')).toBeNull();
  });

  it('does not create a download when the request fails', async () => {
    api.get.mockRejectedValue(new Error('Not found'));
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(downloadFinanceFile(7, 404, 'missing.pdf')).rejects.toThrow('Not found');

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});
