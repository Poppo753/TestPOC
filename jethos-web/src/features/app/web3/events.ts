import { getReadContext } from '../infrastructure/contracts';
import { deployment, explorerTransaction } from '../infrastructure/deployment';

interface ContractEvent {
  transactionHash: string;
  index: number;
  blockNumber: number;
  args: { amount: bigint; shares?: bigint; sharesReceived?: bigint };
}

export async function readUserEvents(address: string, { blockWindow = 50_000 } = {}) {
  const ctx = await getReadContext();
  const latest = await ctx.provider.getBlockNumber();
  const from = Math.max(0, latest - blockWindow);
  const [deposits, withdrawals] = await Promise.all([
    ctx.liquidity.queryFilter(ctx.liquidity.filters.Deposit(address), from, latest),
    ctx.liquidity.queryFilter(ctx.liquidity.filters.Withdrawn(address), from, latest),
  ]);
  const normalize = (value: unknown, type: 'deposit' | 'withdrawal') => {
    const event = value as ContractEvent;
    return {
      id: `${event.transactionHash}:${event.index}`,
      type,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      explorerUrl: explorerTransaction(event.transactionHash),
      amount: event.args.amount,
      shares: type === 'deposit' ? event.args.sharesReceived : event.args.shares,
      baseAsset: deployment.baseAsset.symbol,
    };
  };
  const records = [
    ...deposits.map((event) => normalize(event, 'deposit')),
    ...withdrawals.map((event) => normalize(event, 'withdrawal')),
  ];
  return [...new Map(records.map((event) => [event.id, event])).values()].sort(
    (left, right) => right.blockNumber - left.blockNumber,
  );
}
