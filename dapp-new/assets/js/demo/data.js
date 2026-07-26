/**
 * Editorial product model used only by the browser demo.
 *
 * The homepage presents one product at three depths:
 * - Base: choose amount and risk while Jethos hides route complexity;
 * - Pro: also choose the destination network and inspect protocols;
 * - Advanced: also choose the asset and inspect policy/evidence.
 *
 * None of these values are live products, quotes or deployment records.
 */
export const DEMO_ASSETS = Object.freeze([
  Object.freeze({ id: 'usdc', symbol: 'USDC', name: 'USD Coin', units: '5,000 USDC', value: 5000, color: '#38bdf8' }),
  Object.freeze({ id: 'usdt', symbol: 'USDT', name: 'Tether', units: '1,800 USDT', value: 1800, color: '#2dd4bf' }),
  Object.freeze({ id: 'btc', symbol: 'BTC', name: 'Bitcoin', units: '0.021 BTC', value: 1800, color: '#fb9b23' }),
  Object.freeze({ id: 'eth', symbol: 'ETH', name: 'Ether', units: '0.48 ETH', value: 1400, color: '#a78bfa' }),
]);

export const DEMO_NETWORKS = Object.freeze([
  Object.freeze({ id: 'plasma', name: 'Plasma', adjustment: .004 }),
  Object.freeze({ id: 'ethereum', name: 'Ethereum', adjustment: -.002 }),
  Object.freeze({ id: 'arbitrum', name: 'Arbitrum', adjustment: .003 }),
  Object.freeze({ id: 'base', name: 'Base', adjustment: .002 }),
  Object.freeze({ id: 'bnb', name: 'BNB Chain', adjustment: .004 }),
]);

const profile = (value) => Object.freeze({
  ...value,
  allocations: Object.freeze(value.allocations.map((route) => Object.freeze(route))),
  risks: Object.freeze(value.risks),
});

export const DEMO_VAULTS = Object.freeze([
  profile({
    id: 'conservative',
    name: 'Conservative',
    profile: 'Conservative',
    description: 'Keep a large liquid reserve and use a limited set of lower-complexity lending routes.',
    apy: .032,
    risk: 'Lower',
    riskScore: 2,
    liquidity: 'High liquidity',
    accent: 'cyan',
    allocations: [
      { name: 'Liquid reserve', category: 'Reserve', protocol: 'Vault reserve', percent: 50, apy: 0, proof: 'Recorded balance' },
      { name: 'Diversified lending', category: 'Lending', protocol: 'Aave V3', percent: 25, apy: .041, proof: 'Linked adapter' },
      { name: 'Diversified lending', category: 'Lending', protocol: 'Morpho', percent: 15, apy: .048, proof: 'Linked market' },
      { name: 'Short-duration lending', category: 'Lending', protocol: 'Euler V2', percent: 10, apy: .053, proof: 'Linked adapter' },
    ],
    baseExplanation: 'A part stays immediately available. The rest is supplied to lending markets, where borrowers pay interest. This strategy does not borrow assets or use leverage.',
    proExplanation: 'Supply-only positions are divided across approved lending protocols. Yield and withdrawal timing depend on utilization, protocol state and available liquidity.',
    advancedExplanation: 'Borrowing: disabled. Leverage: 1.00x. Minimum reserve: 45%. Maximum route: 30%. Rebalance trigger: utilization above 82% or a route failing policy.',
    risks: ['Smart-contract risk', 'Asset issuer or wrapper risk', 'Lending-market liquidity', 'Protocol governance risk'],
  }),
  profile({
    id: 'balanced',
    name: 'Balanced',
    profile: 'Balanced',
    description: 'Balance liquidity with broader lending and liquid-staking opportunities.',
    apy: .051,
    risk: 'Moderate',
    riskScore: 3,
    liquidity: 'Balanced exit profile',
    accent: 'violet',
    allocations: [
      { name: 'Liquid reserve', category: 'Reserve', protocol: 'Vault reserve', percent: 25, apy: 0, proof: 'Recorded balance' },
      { name: 'Lending routes', category: 'Lending', protocol: 'Aave V3', percent: 30, apy: .052, proof: 'Linked adapter' },
      { name: 'Lending routes', category: 'Lending', protocol: 'Morpho', percent: 20, apy: .061, proof: 'Linked market' },
      { name: 'Staking routes', category: 'Staking', protocol: 'Ether.fi / Lido', percent: 25, apy: .064, proof: 'Linked position' },
    ],
    baseExplanation: 'More of the balance is invested across different types of routes, while a reserve remains available for ordinary withdrawals.',
    proExplanation: 'The strategy combines lending with approved liquid-staking routes. Jethos compares net yield, liquidity, costs and concentration before allocating.',
    advancedExplanation: 'Borrowing may be enabled only for an approved bounded strategy. Illustrative maximum leverage: 1.25x. Minimum health factor: 1.80. Maximum route: 35%.',
    risks: ['Smart-contract risk', 'Lending and staking dependencies', 'Wrapper or depeg risk', 'Liquidity delay', 'Cross-protocol concentration'],
  }),
  profile({
    id: 'opportunity',
    name: 'Opportunity',
    profile: 'Opportunity',
    description: 'Accept more moving parts and variable liquidity for a wider eligible opportunity set.',
    apy: .078,
    risk: 'Higher',
    riskScore: 4,
    liquidity: 'Variable liquidity',
    accent: 'amber',
    allocations: [
      { name: 'Liquid reserve', category: 'Reserve', protocol: 'Vault reserve', percent: 10, apy: 0, proof: 'Recorded balance' },
      { name: 'Lending routes', category: 'Lending', protocol: 'Euler / Morpho', percent: 25, apy: .072, proof: 'Linked adapters' },
      { name: 'Yield routes', category: 'Yield markets', protocol: 'Pendle', percent: 30, apy: .094, proof: 'Linked market' },
      { name: 'Liquidity routes', category: 'Liquidity', protocol: 'GMX', percent: 35, apy: .108, proof: 'Linked position' },
    ],
    baseExplanation: 'More capital can enter variable routes. Potential return is higher, but value and withdrawal timing can change more.',
    proExplanation: 'Eligible routes can include lending, tokenized yield and liquidity markets. Headline APY never wins automatically: costs, depth and risk limits remain gates.',
    advancedExplanation: 'Borrowing and loops require explicit policy. Illustrative maximum leverage: 1.60x. Minimum health factor: 1.55. Maximum route: 40%. Automatic deleveraging begins before the hard limit.',
    risks: ['Smart-contract and composability risk', 'Variable or delayed liquidity', 'Market and oracle risk', 'Leverage or liquidation risk', 'Higher operational complexity'],
  }),
]);

export const assetById = (id) => DEMO_ASSETS.find((asset) => asset.id === id);
export const networkById = (id) => DEMO_NETWORKS.find((network) => network.id === id);
export const profileById = (id) => DEMO_VAULTS.find((vault) => vault.id === id);

export function vaultId(profileId, chainId = 'plasma', assetId = 'usdc') {
  return `${profileId}:${chainId}:${assetId}`;
}

export function vaultById(id) {
  const [profileId, chainId = 'plasma', assetId = 'usdc'] = String(id || '').split(':');
  const base = profileById(profileId);
  const chain = networkById(chainId);
  const asset = assetById(assetId);
  if (!base || !chain || !asset) return undefined;
  const assetAdjustment = assetId === 'btc' ? .011 : assetId === 'eth' ? .008 : assetId === 'usdt' ? .0015 : 0;
  return {
    ...base,
    id: vaultId(profileId, chainId, assetId),
    name: `${chain.name} ${asset.symbol} ${base.name}`,
    chain,
    asset,
    apy: Math.max(0, base.apy + chain.adjustment + assetAdjustment),
  };
}
