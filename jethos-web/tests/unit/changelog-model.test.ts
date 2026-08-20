import { describe, expect, it } from 'vitest';

import type { Changelog } from '../../src/content/schemas';
import { toChangelogItems } from '../../src/features/changelog/model';

describe('changelog view model', () => {
  it('maps source types and dates to finite visual variants', () => {
    const fixture: Changelog = {
      version: '1.0.0',
      updatedAt: '2026-07-23',
      entries: [
        {
          date: '2026-07-14',
          title: 'Deployment',
          type: 'deployment',
          changes: ['Recorded evidence'],
        },
      ],
    };

    expect(toChangelogItems(fixture)).toEqual([
      expect.objectContaining({
        badge: 'poc',
        displayDate: '14 JUL 2026',
        typeLabel: 'Deployment record',
      }),
    ]);
  });
});
