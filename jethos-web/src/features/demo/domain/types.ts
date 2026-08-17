export type AssetId = 'usdc' | 'usdt' | 'btc' | 'eth';
export type NetworkId = 'plasma' | 'ethereum' | 'arbitrum' | 'base' | 'bnb';
export type ProfileId = 'conservative' | 'balanced' | 'opportunity';
export type VaultId = `${ProfileId}:${NetworkId}:${AssetId}`;

export interface DemoAsset {
  id: AssetId;
  symbol: string;
  name: string;
  units: string;
  value: number;
  color: string;
}

export interface DemoNetwork {
  id: NetworkId;
  name: string;
  adjustment: number;
}

export interface DemoAllocation {
  name: string;
  category: string;
  protocol: string;
  percent: number;
  apy: number;
  proof: string;
}

export interface DemoVaultProfile {
  id: ProfileId;
  name: string;
  profile: string;
  description: string;
  apy: number;
  risk: string;
  riskScore: number;
  liquidity: string;
  accent: string;
  allocations: readonly DemoAllocation[];
  baseExplanation: string;
  proExplanation: string;
  advancedExplanation: string;
  policy: Readonly<Record<string, string>>;
  risks: readonly string[];
}

export interface DemoVault extends Omit<DemoVaultProfile, 'id' | 'name'> {
  id: VaultId;
  name: string;
  chain: DemoNetwork;
  asset: DemoAsset;
}

export interface DemoPosition {
  principal: number;
  daysAccrued: number;
}

export interface DemoActivity {
  id: string;
  timestamp: string;
  type: string;
  vaultId: VaultId | null;
  vaultName: string;
  asset: string | null;
  chain: string | null;
  amount: number;
  status: 'Simulated';
}

export interface DemoState {
  schemaVersion: 3;
  walletAssets: Record<AssetId, number>;
  positions: Partial<Record<VaultId, DemoPosition>>;
  activity: DemoActivity[];
  simulatedDays: number;
  onboardingComplete: boolean;
}

export interface DemoSummary {
  wallet: number;
  vaultValue: number;
  principal: number;
  earnings: number;
  total: number;
  positionCount: number;
}
