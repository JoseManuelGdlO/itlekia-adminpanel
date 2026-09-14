import { describe, it, expect } from 'vitest';
import api from './client';

describe('api client', () => {
  it('is configured with withCredentials so the auth cookie is sent', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });
});
