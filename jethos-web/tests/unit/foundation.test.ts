import { describe, expect, it } from 'vitest';

import { parseSiteEnvironment } from '../../src/config/environment';

describe('enterprise foundation', () => {
  it('runs deterministic TypeScript tests', () => {
    expect(['static', 'typed', 'tested']).toHaveLength(3);
  });

  it('accepts only declared deployment environments', () => {
    expect(parseSiteEnvironment(undefined)).toBe('development');
    expect(parseSiteEnvironment('preview')).toBe('preview');
    expect(() => parseSiteEnvironment('staging')).toThrow('Invalid PUBLIC_SITE_ENV');
  });
});
