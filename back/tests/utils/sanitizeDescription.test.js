const { sanitizeDescription, MAX_TASK_DESCRIPTION_LENGTH } = require('../../src/utils/sanitizeDescription');

describe('sanitizeDescription', () => {
  it('keeps allowlisted markup and strips scripts', () => {
    const clean = sanitizeDescription(
      '<p>Hello <strong>x</strong><script>alert(1)</script></p><a href="https://ex.com">l</a>'
    );
    expect(clean).toContain('<strong>x</strong>');
    expect(clean).toContain('href="https://ex.com"');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('alert');
  });

  it('returns null for empty or blank html', () => {
    expect(sanitizeDescription(null)).toBeNull();
    expect(sanitizeDescription('')).toBeNull();
    expect(sanitizeDescription('<p></p>')).toBeNull();
    expect(sanitizeDescription('<p>   </p>')).toBeNull();
  });

  it('strips javascript urls', () => {
    const clean = sanitizeDescription('<a href="javascript:alert(1)">x</a>');
    expect(clean).not.toMatch(/javascript:/i);
  });

  it('throws Invalid description when over the cap', () => {
    expect(MAX_TASK_DESCRIPTION_LENGTH).toBe(20000);
    const huge = `<p>${'a'.repeat(20001)}</p>`;
    expect(() => sanitizeDescription(huge)).toThrow('Invalid description');
  });
});
