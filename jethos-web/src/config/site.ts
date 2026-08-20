export type PageId =
  | 'home'
  | 'how'
  | 'vaults'
  | 'risk'
  | 'trust'
  | 'roadmap'
  | 'docs'
  | 'demo'
  | 'app'
  | 'security'
  | 'protocol'
  | 'developers'
  | 'vision'
  | 'faq'
  | 'team'
  | 'changelog';

interface NavigationItem {
  id: PageId;
  href: string;
  label: string;
}

interface FooterGroup {
  title: string;
  links: Array<{ label: string; href: string }>;
}

export const siteConfig = {
  name: 'Jethos',
  positioning: 'Home banking, rebuilt around ownership.',
  navigation: [
    { id: 'home', href: '/index.html', label: 'Home' },
    { id: 'how', href: '/pages/how-it-works.html', label: 'How it works' },
    { id: 'vaults', href: '/pages/vaults.html', label: 'Vaults' },
    { id: 'risk', href: '/pages/risk-transparency.html', label: 'Risk' },
    { id: 'trust', href: '/pages/trust-center.html', label: 'Trust' },
    { id: 'roadmap', href: '/pages/roadmap.html', label: 'Roadmap' },
    { id: 'docs', href: '/pages/docs.html', label: 'Docs' },
  ] satisfies NavigationItem[],
  footer: [
    {
      title: 'Product',
      links: [
        { label: 'Interactive demo', href: '/demo/index.html' },
        { label: 'How it works', href: '/pages/how-it-works.html' },
        { label: 'Vaults', href: '/pages/vaults.html' },
        { label: 'Risk & transparency', href: '/pages/risk-transparency.html' },
        { label: 'PoC console', href: '/app.html' },
      ],
    },
    {
      title: 'Evidence',
      links: [
        { label: 'Trust Center', href: '/pages/trust-center.html' },
        { label: 'Security', href: '/pages/security.html' },
        { label: 'Protocol', href: '/pages/protocol.html' },
        { label: 'Developers', href: '/pages/developers.html' },
      ],
    },
    {
      title: 'Direction',
      links: [
        { label: 'Vision', href: '/pages/vision.html' },
        { label: 'Roadmap', href: '/pages/roadmap.html' },
        { label: 'FAQ', href: '/pages/faq.html' },
        { label: 'Documentation', href: '/pages/docs.html' },
        { label: 'Team disclosure', href: '/pages/team.html' },
        { label: 'Changelog', href: '/pages/changelog.html' },
      ],
    },
  ] satisfies FooterGroup[],
  disclaimer:
    'Private proof of concept. Jethos is not a bank, is not audited as a complete system, and does not guarantee returns, principal or immediate liquidity.',
} as const;

export function sitePath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}` || '/';
}
