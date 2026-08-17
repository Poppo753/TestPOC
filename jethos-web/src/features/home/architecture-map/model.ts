export const chainIds = ['arbitrum', 'base', 'ethereum'] as const;
export const assetIds = ['usdc', 'eth', 'btc'] as const;
export const riskIds = ['conservative', 'balanced', 'opportunity'] as const;

export type ChainId = (typeof chainIds)[number];
export type AssetId = (typeof assetIds)[number];
export type RiskId = (typeof riskIds)[number];
export type RiskTier = 'Conservative' | 'Balanced' | 'Opportunity';

interface RouteSet {
  core: string[];
  expanded: string[];
  opportunity: string[];
}

export interface RouteCandidate {
  name: string;
  tier: RiskTier;
  detail: string;
}

export const routeCandidates: Record<ChainId, Record<AssetId, RouteSet>> = {
  arbitrum: {
    usdc: {
      core: ['Aave V3', 'Compound V3', 'Dolomite'],
      expanded: ['Pendle PT-USDC', 'Camelot Stable LP'],
      opportunity: ['GMX GLV', 'Pendle YT-USDC', 'GMX GM Pool'],
    },
    eth: {
      core: ['Aave V3', 'Compound V3', 'Dolomite'],
      expanded: ['Pendle PT-ETH', 'Lido wstETH route'],
      opportunity: ['GMX ETH Pool', 'Pendle YT-ETH', 'Camelot ETH LP'],
    },
    btc: {
      core: ['Aave V3', 'Dolomite', 'Compound V3'],
      expanded: ['Pendle PT-BTC', 'Camelot BTC LP'],
      opportunity: ['GMX BTC Pool', 'Pendle YT-BTC', 'GMX GLV'],
    },
  },
  base: {
    usdc: {
      core: ['Aave V3', 'Morpho', 'Moonwell'],
      expanded: ['Aerodrome Stable LP', 'Seamless'],
      opportunity: ['Extra Finance', 'Aerodrome Volatile LP', 'Moonwell Loop'],
    },
    eth: {
      core: ['Aave V3', 'Morpho', 'Moonwell'],
      expanded: ['Aerodrome WETH LP', 'Seamless Loop'],
      opportunity: ['Extra Finance', 'Aerodrome Concentrated LP', 'Leveraged Loop'],
    },
    btc: {
      core: ['Aave V3', 'Morpho cbBTC', 'Moonwell'],
      expanded: ['Aerodrome cbBTC LP', 'Seamless'],
      opportunity: ['Extra Finance', 'Aerodrome Volatile LP', 'Leveraged cbBTC Loop'],
    },
  },
  ethereum: {
    usdc: {
      core: ['Aave V3', 'Euler V2', 'Morpho'],
      expanded: ['Curve Stable Pool', 'Convex'],
      opportunity: ['Pendle YT-USDe', 'Gearbox', 'Curve Concentrated Route'],
    },
    eth: {
      core: ['Aave V3', 'Euler V2', 'Morpho'],
      expanded: ['Lido stETH', 'Ether.fi eETH'],
      opportunity: ['Pendle YT-weETH', 'Gearbox', 'Restaking Route'],
    },
    btc: {
      core: ['Aave V3', 'Morpho', 'Euler V2'],
      expanded: ['Curve BTC Pool', 'Convex'],
      opportunity: ['Pendle BTC Route', 'Gearbox', 'Concentrated BTC LP'],
    },
  },
};

export const riskAccents: Record<RiskId, string> = {
  conservative: '#67e8f9',
  balanced: '#a78bfa',
  opportunity: '#fbbf24',
};

export const isChainId = (value: string | undefined): value is ChainId =>
  Boolean(value && chainIds.includes(value as ChainId));
export const isAssetId = (value: string | undefined): value is AssetId =>
  Boolean(value && assetIds.includes(value as AssetId));
export const isRiskId = (value: string | undefined): value is RiskId =>
  Boolean(value && riskIds.includes(value as RiskId));

export function riskLabel(risk: RiskId): RiskTier {
  return `${risk.charAt(0).toUpperCase()}${risk.slice(1)}` as RiskTier;
}

export function colorForTier(tier: RiskTier): string {
  return tier === 'Conservative'
    ? riskAccents.conservative
    : tier === 'Balanced'
      ? riskAccents.balanced
      : riskAccents.opportunity;
}

export function candidatesFor(chain: ChainId, asset: AssetId, risk: RiskId): RouteCandidate[] {
  const catalog = routeCandidates[chain][asset];
  if (risk === 'conservative') {
    return catalog.core.map((name) => ({
      name,
      tier: 'Conservative',
      detail: 'Conservative route candidate',
    }));
  }
  if (risk === 'balanced') {
    return [
      ...catalog.core.slice(0, 3).map((name) => ({
        name,
        tier: 'Conservative' as const,
        detail: 'Conservative route available to this vault',
      })),
      ...catalog.expanded.map((name) => ({
        name,
        tier: 'Balanced' as const,
        detail: 'Additional balanced route candidate',
      })),
    ];
  }
  return [
    ...catalog.core.slice(0, 2).map((name) => ({
      name,
      tier: 'Conservative' as const,
      detail: 'Conservative route available to this vault',
    })),
    ...catalog.expanded.slice(0, 2).map((name) => ({
      name,
      tier: 'Balanced' as const,
      detail: 'Balanced route available to this vault',
    })),
    ...catalog.opportunity.map((name) => ({
      name,
      tier: 'Opportunity' as const,
      detail: 'Additional opportunity route candidate',
    })),
  ];
}
