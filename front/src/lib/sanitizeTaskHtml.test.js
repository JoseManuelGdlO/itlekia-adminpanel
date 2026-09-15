import { describe, it, expect } from 'vitest';
import { sanitizeTaskHtml } from './sanitizeTaskHtml';

describe('sanitizeTaskHtml', () => {
  it('keeps strong and drops script', () => {
    const html = sanitizeTaskHtml('<p><strong>ok</strong><script>alert(1)</script></p>');
    expect(html).toContain('<strong>ok</strong>');
    expect(html).not.toContain('script');
  });
});
