import {
  readProtocolSnapshot,
  readUserSnapshot,
  readVaultSnapshot as readVault,
} from '../infrastructure/readers';

export { attempt } from '../infrastructure/readers';
export { readProtocolSnapshot, readUserSnapshot };

/** The parity view has one source label, so a total critical outage is surfaced globally. */
export async function readVaultSnapshot() {
  const snapshot = await readVault();
  const critical = [
    snapshot.poolValue,
    snapshot.reserve,
    snapshot.depositsEnabled,
    snapshot.withdrawsEnabled,
  ];
  if (critical.every((result) => !result.ok))
    throw new Error('All critical Arbitrum RPC reads were unavailable.');
  return snapshot;
}
