import { getAddress } from 'ethers';

export const deployment = Object.freeze({
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
} as const);

export type Deployment = typeof deployment;

export const explorerAddress = (address: string): string =>
  `${deployment.chain.explorerUrl}/address/${address}`;
export const explorerTransaction = (hash: string): string =>
  `${deployment.chain.explorerUrl}/tx/${hash}`;

export function validateDeployment(value: Deployment = deployment): true {
  const addresses = [value.baseAsset.address, ...Object.values(value.contracts)];
  for (const address of addresses) getAddress(address);
  if (!Number.isInteger(value.chain.id) || value.chain.id <= 0) throw new Error('Invalid chain id');
  if (Number.parseInt(value.chain.hexId, 16) !== value.chain.id)
    throw new Error('Chain id mismatch');
  return true;
}
