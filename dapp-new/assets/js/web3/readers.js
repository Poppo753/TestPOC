import { DEPLOYMENT } from './deployment-config.js';
import { getReadContext } from './contracts.js';

const withTimeout = (promise, ms, label) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))]);
const attempt = async (label, read) => {
  try { return { ok: true, value: await withTimeout(Promise.resolve().then(read), 15000, label) }; }
  catch (error) { return { ok: false, value: null, error: error.shortMessage || error.reason || error.message || String(error) }; }
};

/**
 * Public snapshot. Every field retains success/error metadata, so a failed RPC
 * can never silently look like a real zero balance.
 */
export async function readVaultSnapshot() {
  const ctx = await getReadContext();
  const reads = await Promise.all([
    attempt('pool value', () => ctx.valueCalculator.getTotalPoolValueView()),
    attempt('total supply', () => ctx.shares.totalSupply()),
    attempt('share metadata', async () => ({ symbol: await ctx.shares.symbol(), decimals: Number(await ctx.shares.decimals()) })),
    attempt('deposit state', () => ctx.liquidity.depositsEnabled()),
    attempt('withdraw state', () => ctx.liquidity.withdrawsEnabled()),
    attempt('deposit fee', () => ctx.liquidity.depositFee()),
    attempt('withdraw fee', () => ctx.liquidity.withdrawFee()),
    attempt('proxy pause', () => ctx.shares.paused()),
    attempt('liquidity pause', () => ctx.liquidity.paused()),
    attempt('base reserve', () => ctx.baseAsset.balanceOf(DEPLOYMENT.contracts.proxyGeneral)),
  ]);
  const [poolValue,totalSupply,shareMeta,depositsEnabled,withdrawsEnabled,depositFee,withdrawFee,proxyPaused,liquidityPaused,reserve] = reads;
  return { source: 'Arbitrum RPC', timestamp: new Date().toISOString(), poolValue,totalSupply,shareMeta,depositsEnabled,withdrawsEnabled,depositFee,withdrawFee,proxyPaused,liquidityPaused,reserve };
}

export async function readUserSnapshot(address) {
  const ctx = await getReadContext();
  const [nativeBalance,baseBalance,shareBalance,allowance,estimatedRedeem] = await Promise.all([
    attempt('native balance', () => ctx.provider.getBalance(address)),
    attempt('USDC balance', () => ctx.baseAsset.balanceOf(address)),
    attempt('share balance', () => ctx.shares.balanceOf(address)),
    attempt('USDC allowance', () => ctx.baseAsset.allowance(address, DEPLOYMENT.contracts.liquidityManager)),
    attempt('position estimate', async () => { const shares = await ctx.shares.balanceOf(address); return shares === 0n ? 0n : ctx.liquidity.calculateWithdrawAmount(shares); }),
  ]);
  return { source: 'Arbitrum RPC', timestamp: new Date().toISOString(), address, nativeBalance,baseBalance,shareBalance,allowance,estimatedRedeem };
}

export async function readProtocolSnapshot() {
  const ctx = await getReadContext();
  const namesRead = await attempt('protocol names', () => ctx.protocolManager.getAllProtocolNames());
  const names = namesRead.ok ? [...namesRead.value] : [...DEPLOYMENT.recordedProtocols];
  const protocols = await Promise.all(names.map(async (name) => {
    const [info,breakdown] = await Promise.all([
      attempt(`${name} info`, () => ctx.protocolManager.getProtocolInfo(name)),
      attempt(`${name} breakdown`, () => ctx.protocolManager.getProtocolPositionBreakdown(name)),
    ]);
    return { name, info, breakdown, provenance: namesRead.ok ? 'live registry' : 'deployment record' };
  }));
  const [activeCount,totalValue,globalHealth] = await Promise.all([
    attempt('active protocol count', () => ctx.protocolManager.getActiveProtocolCount()),
    attempt('protocol total value', () => ctx.protocolManager.getAllProtocolsValue()),
    attempt('global health factor', () => ctx.protocolManager.getGlobalHealthFactor()),
  ]);
  return { source: namesRead.ok ? 'Arbitrum RPC' : 'deployment record with partial live reads', timestamp: new Date().toISOString(), namesRead,protocols,activeCount,totalValue,globalHealth };
}

export { attempt };

