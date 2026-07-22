import { DEPLOYMENT, validateDeployment } from './deployment-config.js';
import { ERC20_ABI, SHARE_ABI, LIQUIDITY_MANAGER_ABI, VALUE_CALCULATOR_ABI, PROTOCOL_MANAGER_ABI } from './abis.js';
import { loadEthers } from './ethers-loader.js';

let readContextPromise;

/** Read context uses a public RPC and therefore works without a connected wallet. */
export async function getReadContext() {
  if (!readContextPromise) readContextPromise = buildReadContext().catch((error) => { readContextPromise = undefined; throw error; });
  return readContextPromise;
}
async function buildReadContext() {
  const ethers = await loadEthers();
  validateDeployment(ethers);
  const provider = new ethers.JsonRpcProvider(DEPLOYMENT.chain.rpcUrl, DEPLOYMENT.chain.id, { staticNetwork: true });
  return {
    ethers, provider,
    baseAsset: new ethers.Contract(DEPLOYMENT.baseAsset.address, ERC20_ABI, provider),
    shares: new ethers.Contract(DEPLOYMENT.contracts.proxyGeneral, SHARE_ABI, provider),
    liquidity: new ethers.Contract(DEPLOYMENT.contracts.liquidityManager, LIQUIDITY_MANAGER_ABI, provider),
    valueCalculator: new ethers.Contract(DEPLOYMENT.contracts.valueCalculator, VALUE_CALCULATOR_ABI, provider),
    protocolManager: new ethers.Contract(DEPLOYMENT.contracts.protocolManager, PROTOCOL_MANAGER_ABI, provider),
  };
}

/** Write context reuses verified ABIs but connects only user-callable contracts. */
export async function getWriteContext(walletSession) {
  if (!walletSession?.signer || !walletSession.address) throw new Error('Connect a wallet before creating a write context.');
  if (walletSession.chainId !== DEPLOYMENT.chain.id) throw new Error(`Switch the wallet to ${DEPLOYMENT.chain.name}.`);
  const ethers = await loadEthers();
  return {
    ethers,
    baseAsset: new ethers.Contract(DEPLOYMENT.baseAsset.address, ERC20_ABI, walletSession.signer),
    liquidity: new ethers.Contract(DEPLOYMENT.contracts.liquidityManager, LIQUIDITY_MANAGER_ABI, walletSession.signer),
  };
}

