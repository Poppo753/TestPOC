export const SITE_ENVIRONMENTS = ['development', 'preview', 'production'] as const;

export type SiteEnvironment = (typeof SITE_ENVIRONMENTS)[number];

export function parseSiteEnvironment(value: string | undefined): SiteEnvironment {
  if (value === undefined || value === '') return 'development';
  if (SITE_ENVIRONMENTS.includes(value as SiteEnvironment)) return value as SiteEnvironment;
  throw new Error(`Invalid PUBLIC_SITE_ENV: ${value}`);
}
