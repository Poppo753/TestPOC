import { describe, expect, it } from 'vitest';

import {
  assertSafeInternalTarget,
  legacyRedirects,
  routeIdFromHtmlPath,
} from '../../src/config/legacy-routing';

describe('legacy route compatibility', () => {
  it('maps all four legacy root URLs to safe internal targets', () => {
    expect(legacyRedirects).toHaveLength(4);
    expect(
      Object.fromEntries(legacyRedirects.map(({ source, target }) => [source, target])),
    ).toEqual({
      '/config.html': '/pages/protocol.html',
      '/documentation.html': '/pages/docs.html',
      '/landing.html': '/index.html',
      '/portfolio.html': '/app.html',
    });
    for (const redirect of legacyRedirects)
      expect(() => assertSafeInternalTarget(redirect.target)).not.toThrow();
  });

  it('derives only flat HTML route identifiers', () => {
    expect(routeIdFromHtmlPath('/documentation.html')).toBe('documentation');
    expect(() => routeIdFromHtmlPath('/pages/docs.html')).toThrow(/Unsupported/u);
    expect(() => assertSafeInternalTarget('https://example.com')).toThrow(/Unsafe/u);
    expect(() => assertSafeInternalTarget('//example.com')).toThrow(/Unsafe/u);
  });
});
