/**
 * Single source of truth for the web console.
 *
 * This file intentionally describes ONE deployment. A different base asset or
 * chain is a different vault system and must receive a new, verified config.
 * Addresses were transcribed from scripts/manifests/arbitrum-usdc-poc-1.json;
 * the manifest is a deployment record, while runtime reads are the live source.
 */
export const DEPLOYMENT = Object.freeze({
  id: 'arbitrum-usdc-poc-1',
  status: 'Private PoC',
  recordedAt: '2026-07-14T17:29:00.000Z',
  chain: Object.freeze({
    id: 42161,
    hexId: '0xa4b1',
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: Object.freeze({ name: 'Ether', symbol: 'ETH', decimals: 18 }),
  }),
  baseAsset: Object.freeze({
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
  }),
  contracts: Object.freeze({
    beacon: '0x145833173cc47Fde624Be8cc4f391eeA07b82a16',
    proxyGeneral: '0xb070303C3634eA404593A87725aaCb18E1d5d9BF',
    valueCalculator: '0x1850e1E37a7a46E74bBDAE5704Afe0C79BCb7c1A',
    liquidityManager: '0x80fB731B78D2C7180cd22eCF18Dc4243546ce192',
    protocolManager: '0x91fEc8f3161504Dd20c2Ed58B8E6003854AC5A8D',
    parameterManager: '0x3972e959A3fB28ce38543Dc42A249fc0dDC229b5',
    emergencyHandler: '0xcEcabED130B96B8F496c3B6D1Fe5A7556C0AB563',
  }),
  recordedProtocols: Object.freeze(['AaveV3', 'EulerV2', 'Morpho', 'MorphoVault']),
});

export function explorerAddress(address) { return `${DEPLOYMENT.chain.explorerUrl}/address/${address}`; }
export function explorerTransaction(hash) { return `${DEPLOYMENT.chain.explorerUrl}/tx/${hash}`; }

export function validateDeployment(ethers) {
  const addresses = [DEPLOYMENT.baseAsset.address, ...Object.values(DEPLOYMENT.contracts)];
  const invalid = addresses.filter((address) => !ethers.isAddress(address));
  if (invalid.length) throw new Error(`Invalid deployment address: ${invalid.join(', ')}`);
  if (!Number.isInteger(DEPLOYMENT.chain.id) || DEPLOYMENT.chain.id <= 0) throw new Error('Invalid chain id');
  return true;
}

