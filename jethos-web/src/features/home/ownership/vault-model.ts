export const vaultModes = ['base', 'pro', 'advanced'] as const;
export const vaultChains = ['plasma', 'ethereum', 'arbitrum', 'base', 'bnb'] as const;
export const vaultTokens = ['usdc', 'usdt', 'btc', 'eth'] as const;

export type VaultMode = (typeof vaultModes)[number];
export type VaultChain = (typeof vaultChains)[number];
export type VaultToken = (typeof vaultTokens)[number];

export const modeCopy: Record<VaultMode, string> = {
  base: 'Choose how much to invest and the level of risk that feels right. Jethos keeps network and asset details out of the way.',
  pro: 'Choose the amount, your risk level and the network you want to use.',
  advanced:
    'Choose the amount, risk, network and asset. Every option stays visible before you confirm.',
};

export const baseVaults = [
  {
    key: 'conservative',
    name: 'Conservative',
    detail: 'More liquidity, fewer moving parts',
    apy: 3.2,
    allocations: [
      { label: 'Liquid reserve', percent: 50, apy: 0 },
      { label: 'Diversified lending', percent: 35, apy: 4.9 },
      { label: 'Short-duration routes', percent: 15, apy: 3.8 },
    ],
  },
  {
    key: 'balanced',
    name: 'Balanced',
    detail: 'A balance between growth and flexibility',
    apy: 5.1,
    allocations: [
      { label: 'Liquid reserve', percent: 25, apy: 0 },
      { label: 'Diversified lending', percent: 45, apy: 5.4 },
      { label: 'Liquidity routes', percent: 30, apy: 6.2 },
    ],
  },
  {
    key: 'opportunity',
    name: 'Opportunity',
    detail: 'More ways to earn, with more risk',
    apy: 7.8,
    allocations: [
      { label: 'Liquid reserve', percent: 10, apy: 0 },
      { label: 'Lending routes', percent: 40, apy: 7.2 },
      { label: 'Opportunity routes', percent: 50, apy: 10.4 },
    ],
  },
] as const;

export type VaultKey = (typeof baseVaults)[number]['key'];
export type VaultDefinition = (typeof baseVaults)[number];

export const allocationColors = ['#8b5cf6', '#38bdf8', '#2dd4bf'] as const;
export const chainLabels: Record<VaultChain, string> = {
  plasma: 'Plasma',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  base: 'Base',
  bnb: 'BNB Chain',
};
export const tokenLabels: Record<VaultToken, string> = {
  usdc: 'USDC',
  usdt: 'USDT',
  btc: 'BTC',
  eth: 'ETH',
};
const chainAdjustments: Record<VaultChain, number> = {
  plasma: 0.6,
  ethereum: -0.2,
  arbitrum: 0.4,
  base: 0.2,
  bnb: 0.5,
};
const tokenAdjustments: Record<VaultToken, number> = { usdc: 0, usdt: 0.15, btc: 1.1, eth: 0.8 };

export const isVaultMode = (value: string | undefined): value is VaultMode =>
  Boolean(value && vaultModes.includes(value as VaultMode));
export const isVaultChain = (value: string | undefined): value is VaultChain =>
  Boolean(value && vaultChains.includes(value as VaultChain));
export const isVaultToken = (value: string | undefined): value is VaultToken =>
  Boolean(value && vaultTokens.includes(value as VaultToken));
export const isVaultKey = (value: string | undefined): value is VaultKey =>
  Boolean(value && baseVaults.some((vault) => vault.key === value));

export function scenarioAdjustment(mode: VaultMode, chain: VaultChain, token: VaultToken): number {
  const modeAdjustment = mode === 'base' ? 0 : mode === 'pro' ? 0.7 : 1.2;
  const chainAdjustment = mode === 'base' ? 0 : chainAdjustments[chain];
  const tokenAdjustment = mode === 'advanced' ? tokenAdjustments[token] : 0;
  return modeAdjustment + chainAdjustment + tokenAdjustment;
}

export function contextLabel(mode: VaultMode, chain: VaultChain, token: VaultToken): string {
  if (mode === 'base') return 'a simple managed route';
  if (mode === 'pro') return `${chainLabels[chain]} network`;
  return `${chainLabels[chain]} · ${tokenLabels[token]}`;
}
