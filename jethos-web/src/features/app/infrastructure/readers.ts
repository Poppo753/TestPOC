import { deployment } from './deployment';
import { getReadContext, type ReadContext } from './contracts';

export type ReadResult<T> = { ok: true; value: T } | { ok: false; value: null; error: string };

const messageFrom = (error: unknown): string => {
  if (error && typeof error === 'object') {
    for (const key of ['shortMessage', 'reason', 'message'] as const) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === 'string' && value) return value;
    }
  }
  return String(error);
};

export async function attempt<T>(
  label: string,
  read: () => Promise<T> | T,
  timeout = 15_000,
): Promise<ReadResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const expiry = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeout);
    });
    return { ok: true, value: await Promise.race([Promise.resolve().then(read), expiry]) };
  } catch (error) {
    return { ok: false, value: null, error: messageFrom(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function readVaultSnapshot(context?: ReadContext) {
  const ctx = context ?? (await getReadContext());
  const [
    poolValue,
    totalSupply,
    shareMeta,
    depositsEnabled,
    withdrawsEnabled,
    depositFee,
    withdrawFee,
    proxyPaused,
    liquidityPaused,
    reserve,
  ] = await Promise.all([
    attempt('pool value', () => ctx.valueCalculator.getTotalPoolValueView()),
    attempt('total supply', () => ctx.shares.totalSupply()),
    attempt('share metadata', async () => ({
      symbol: await ctx.shares.symbol(),
      decimals: Number(await ctx.shares.decimals()),
    })),
    attempt('deposit state', () => ctx.liquidity.depositsEnabled()),
    attempt('withdraw state', () => ctx.liquidity.withdrawsEnabled()),
    attempt('deposit fee', () => ctx.liquidity.depositFee()),
    attempt('withdraw fee', () => ctx.liquidity.withdrawFee()),
    attempt('proxy pause', () => ctx.shares.paused()),
    attempt('liquidity pause', () => ctx.liquidity.paused()),
    attempt('base reserve', () => ctx.baseAsset.balanceOf(deployment.contracts.proxyGeneral)),
  ]);
  return {
    source: 'Arbitrum RPC',
    timestamp: new Date().toISOString(),
    poolValue,
    totalSupply,
    shareMeta,
    depositsEnabled,
    withdrawsEnabled,
    depositFee,
    withdrawFee,
    proxyPaused,
    liquidityPaused,
    reserve,
  } as const;
}

export async function readUserSnapshot(address: string, context?: ReadContext) {
  const ctx = context ?? (await getReadContext());
  const [nativeBalance, baseBalance, shareBalance, allowance, estimatedRedeem] = await Promise.all([
    attempt('native balance', () => ctx.provider.getBalance(address)),
    attempt('USDC balance', () => ctx.baseAsset.balanceOf(address)),
    attempt('share balance', () => ctx.shares.balanceOf(address)),
    attempt('USDC allowance', () =>
      ctx.baseAsset.allowance(address, deployment.contracts.liquidityManager),
    ),
    attempt('position estimate', async () => {
      const shares = await ctx.shares.balanceOf(address);
      return shares === 0n ? 0n : ctx.liquidity.calculateWithdrawAmount(shares);
    }),
  ]);
  return {
    source: 'Arbitrum RPC',
    timestamp: new Date().toISOString(),
    address,
    nativeBalance,
    baseBalance,
    shareBalance,
    allowance,
    estimatedRedeem,
  } as const;
}

export async function readProtocolSnapshot(context?: ReadContext) {
  const ctx = context ?? (await getReadContext());
  const namesRead = await attempt<readonly string[]>('protocol names', () =>
    ctx.protocolManager.getAllProtocolNames(),
  );
  const names = namesRead.ok ? [...namesRead.value] : [...deployment.recordedProtocols];
  const protocols = await Promise.all(
    names.map(async (name) => {
      const [info, breakdown] = await Promise.all([
        attempt(`${name} info`, () => ctx.protocolManager.getProtocolInfo(name)),
        attempt(`${name} breakdown`, () => ctx.protocolManager.getProtocolPositionBreakdown(name)),
      ]);
      return {
        name,
        info,
        breakdown,
        provenance: namesRead.ok ? 'live registry' : 'deployment record',
      } as const;
    }),
  );
  const [activeCount, totalValue, globalHealth] = await Promise.all([
    attempt('active protocol count', () => ctx.protocolManager.getActiveProtocolCount()),
    attempt('protocol total value', () => ctx.protocolManager.getAllProtocolsValue()),
    attempt('global health factor', () => ctx.protocolManager.getGlobalHealthFactor()),
  ]);
  return {
    source: namesRead.ok ? 'Arbitrum RPC' : 'deployment record with partial live reads',
    timestamp: new Date().toISOString(),
    namesRead,
    protocols,
    activeCount,
    totalValue,
    globalHealth,
  } as const;
}
