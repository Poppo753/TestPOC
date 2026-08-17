import { DEPLOYMENT, explorerTransaction } from './deployment-config.js';
import { getReadContext } from './contracts.js';

/** Queries a bounded range to remain compatible with public RPC limits. */
export async function readUserEvents(address, { blockWindow = 50000 } = {}) {
  const ctx = await getReadContext();
  const latest = await ctx.provider.getBlockNumber();
  const from = Math.max(0, latest - blockWindow);
  const depositFilter = ctx.liquidity.filters.Deposit(address);
  const withdrawFilter = ctx.liquidity.filters.Withdrawn(address);
  const [deposits,withdrawals] = await Promise.all([
    ctx.liquidity.queryFilter(depositFilter, from, latest),
    ctx.liquidity.queryFilter(withdrawFilter, from, latest),
  ]);
  const normalize = (event, type) => ({
    id: `${event.transactionHash}:${event.index}`,
    type,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash,
    explorerUrl: explorerTransaction(event.transactionHash),
    amount: type === 'deposit' ? event.args.amount : event.args.amount,
    shares: type === 'deposit' ? event.args.sharesReceived : event.args.shares,
    baseAsset: DEPLOYMENT.baseAsset.symbol,
  });
  const unique = new Map([...deposits.map((event) => normalize(event, 'deposit')), ...withdrawals.map((event) => normalize(event, 'withdrawal'))].map((event) => [event.id, event]));
  return [...unique.values()].sort((a,b) => b.blockNumber - a.blockNumber);
}

