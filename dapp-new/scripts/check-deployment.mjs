/**
 * Read-only deployment diagnostic. No signer or private key is accepted.
 * Usage: node scripts/check-deployment.mjs [--json]
 */
import { createReadOnlyProvider, DEPLOYMENT, ethers, isJsonMode, jsonStringify } from './lib/diagnostics.mjs';
import { ERC20_ABI, SHARE_ABI, LIQUIDITY_MANAGER_ABI, VALUE_CALCULATOR_ABI } from '../assets/js/web3/abis.js';

const jsonMode = isJsonMode();
const provider = createReadOnlyProvider();
const addresses = { baseAsset: DEPLOYMENT.baseAsset.address, ...DEPLOYMENT.contracts };
const bytecode = {};
for (const [name, address] of Object.entries(addresses)) {
  const code = await provider.getCode(address);
  bytecode[name] = { address, present: code !== '0x', bytes: Math.max(0, (code.length - 2) / 2) };
}

const baseAsset = new ethers.Contract(DEPLOYMENT.baseAsset.address, ERC20_ABI, provider);
const shares = new ethers.Contract(DEPLOYMENT.contracts.proxyGeneral, SHARE_ABI, provider);
const liquidity = new ethers.Contract(DEPLOYMENT.contracts.liquidityManager, LIQUIDITY_MANAGER_ABI, provider);
const calculator = new ethers.Contract(DEPLOYMENT.contracts.valueCalculator, VALUE_CALCULATOR_ABI, provider);
const [network, symbol, decimals, shareSymbol, shareDecimals, supply, poolValue, depositsEnabled, withdrawsEnabled, depositFee, withdrawFee, proxyPaused, liquidityPaused] = await Promise.all([
  provider.getNetwork(), baseAsset.symbol(), baseAsset.decimals(), shares.symbol(), shares.decimals(), shares.totalSupply(), calculator.getTotalPoolValueView(), liquidity.depositsEnabled(), liquidity.withdrawsEnabled(), liquidity.depositFee(), liquidity.withdrawFee(), shares.paused(), liquidity.paused(),
]);

const report = {
  checkedAt: new Date().toISOString(), deployment: DEPLOYMENT.id, chainId: Number(network.chainId),
  asset: { symbol, decimals: Number(decimals), expectedSymbol: DEPLOYMENT.baseAsset.symbol, expectedDecimals: DEPLOYMENT.baseAsset.decimals },
  shares: { symbol: shareSymbol, decimals: Number(shareDecimals), rawSupply: supply.toString() },
  vault: { rawPoolValue: poolValue.toString(), depositsEnabled, withdrawsEnabled, depositFeeBps: depositFee.toString(), withdrawFeeBps: withdrawFee.toString(), proxyPaused, liquidityPaused },
  bytecode,
};

if (jsonMode) console.log(jsonStringify(report));
else {
  console.log(`Deployment: ${report.deployment} on chain ${report.chainId}`);
  console.table(Object.entries(bytecode).map(([component, value]) => ({ component, present: value.present, bytes: value.bytes, address: value.address })));
  console.table({ asset: report.asset, shares: report.shares, vault: report.vault });
}

if (report.chainId !== DEPLOYMENT.chain.id || symbol !== DEPLOYMENT.baseAsset.symbol || Number(decimals) !== DEPLOYMENT.baseAsset.decimals || Object.values(bytecode).some((entry) => !entry.present)) process.exitCode = 1;
