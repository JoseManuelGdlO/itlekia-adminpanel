const { allowedCorsOrigins, isOriginAllowed } = require('../../src/utils/corsOrigins');

describe('corsOrigins', () => {
  it('allows the backoffice origin when CORS_ORIGIN is set', () => {
    const env = { CORS_ORIGIN: 'https://backoffice.intelekia.cloud' };
    expect(isOriginAllowed('https://backoffice.intelekia.cloud', env)).toBe(true);
  });

  it('allows FRONTEND_URL when CORS_ORIGIN is empty', () => {
    const env = {
      CORS_ORIGIN: '',
      FRONTEND_URL: 'https://backoffice.intelekia.cloud',
    };
    expect(allowedCorsOrigins(env)).toEqual(['https://backoffice.intelekia.cloud']);
    expect(isOriginAllowed('https://backoffice.intelekia.cloud', env)).toBe(true);
  });

  it('allows an origin listed in a comma-separated CORS_ORIGIN', () => {
    const env = {
      CORS_ORIGIN: 'https://other.example.com, https://backoffice.intelekia.cloud',
    };
    expect(isOriginAllowed('https://backoffice.intelekia.cloud', env)).toBe(true);
  });

  it('strips a trailing slash so the browser Origin matches', () => {
    const env = { CORS_ORIGIN: 'https://backoffice.intelekia.cloud/' };
    expect(isOriginAllowed('https://backoffice.intelekia.cloud', env)).toBe(true);
  });

  it('rejects an unknown origin', () => {
    const env = { CORS_ORIGIN: 'https://backoffice.intelekia.cloud' };
    expect(isOriginAllowed('https://evil.example.com', env)).toBe(false);
  });
});
