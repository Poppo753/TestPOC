import redirectTargets from './legacy-redirects.json';

type LegacyPath = keyof typeof redirectTargets;

interface RedirectCopy {
  title: string;
  linkLabel: string;
  message: string;
}

const redirectCopy = {
  '/config.html': {
    title: 'Jethos Protocol',
    linkLabel: 'Protocol',
    message: 'Protocol configuration moved to',
  },
  '/documentation.html': {
    title: 'Jethos documentation',
    linkLabel: 'Jethos Docs',
    message: 'Documentation moved to',
  },
  '/landing.html': {
    title: 'Jethos',
    linkLabel: 'Home',
    message: 'The Jethos landing page moved to',
  },
  '/portfolio.html': {
    title: 'Jethos PoC',
    linkLabel: 'Jethos PoC console',
    message: 'Moved to',
  },
} satisfies Record<LegacyPath, RedirectCopy>;

export interface LegacyRedirect extends RedirectCopy {
  source: LegacyPath;
  target: (typeof redirectTargets)[LegacyPath];
  routeId: string;
}

export function routeIdFromHtmlPath(path: string): string {
  const match = path.match(/^\/([^/]+)\.html$/u);
  if (!match?.[1]) throw new Error(`Unsupported legacy redirect path: ${path}`);
  return match[1];
}

export function assertSafeInternalTarget(target: string): void {
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    throw new Error(`Unsafe redirect target: ${target}`);
  }
}

export const legacyRedirects: LegacyRedirect[] = Object.entries(redirectTargets).map(
  ([source, target]) => {
    const legacySource = source as LegacyPath;
    assertSafeInternalTarget(target);
    return {
      source: legacySource,
      target,
      routeId: routeIdFromHtmlPath(legacySource),
      ...redirectCopy[legacySource],
    };
  },
);
