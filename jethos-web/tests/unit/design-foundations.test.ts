import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const readFoundation = (name: string) =>
  readFile(new URL(`../../src/design-system/foundations/${name}`, import.meta.url), 'utf8');

describe('design foundations', () => {
  it('preserves the visual baseline through semantic tokens', async () => {
    const tokens = await readFoundation('tokens.css');

    expect(tokens).toContain('--ink-950: #07101f');
    expect(tokens).toContain('--violet-400: #a78bfa');
    expect(tokens).toContain('--cyan-400: #22d3ee');
    expect(tokens).toContain('--color-background-canvas: var(--ink-950)');
    expect(tokens).toContain('--motion-ease-out: var(--ease-out)');
  });

  it('defines a reduced-motion contract', async () => {
    const motion = await readFoundation('motion.css');

    expect(motion).toContain('@media (prefers-reduced-motion: reduce)');
    expect(motion).toContain('scroll-behavior: auto');
  });
});
