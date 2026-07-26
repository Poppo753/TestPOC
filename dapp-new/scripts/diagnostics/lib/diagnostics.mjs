/**
 * Shared primitives for operational diagnostics.
 *
 * This module deliberately exposes only a read-only JsonRpcProvider. A signer,
 * mnemonic or private-key option does not exist, which keeps every CLI built on
 * it incapable of broadcasting a transaction by construction.
 */
import { ethers } from 'ethers';
import { DEPLOYMENT, validateDeployment } from '../../../assets/js/web3/deployment-config.js';

export function createReadOnlyProvider() {
  validateDeployment(ethers);
  return new ethers.JsonRpcProvider(DEPLOYMENT.chain.rpcUrl, DEPLOYMENT.chain.id, { staticNetwork: true });
}

export function errorMessage(error) {
  return error?.shortMessage || error?.reason || error?.message || String(error);
}

export function jsonStringify(value) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
}

export function isJsonMode(argv = process.argv) {
  return argv.includes('--json');
}

export { ethers, DEPLOYMENT };
