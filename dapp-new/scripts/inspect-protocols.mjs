/**
 * Read-only inspection of ProtocolManager and every registered integration.
 * Usage: node scripts/inspect-protocols.mjs [--json]
 */
import { createReadOnlyProvider, DEPLOYMENT, errorMessage, ethers, isJsonMode, jsonStringify } from './lib/diagnostics.mjs';
import { PROTOCOL_MANAGER_ABI } from '../assets/js/web3/abis.js';

const provider = createReadOnlyProvider();
const manager = new ethers.Contract(DEPLOYMENT.contracts.protocolManager, PROTOCOL_MANAGER_ABI, provider);
const names = [...await manager.getAllProtocolNames()];
const protocols = [];
for (const name of names) {
  const entry = { name, info: null, breakdown: null, errors: [] };
  try {
    const info = await manager.getProtocolInfo(name);
    entry.info = { plugin: info.plugin, lensAdapter: info.lensAdapter, registry: info.registry, isActive: info.isActive, registeredAt: Number(info.registeredAt) };
  } catch (error) { entry.errors.push(`info: ${errorMessage(error)}`); }
  try {
    const values = await manager.getProtocolPositionBreakdown(name);
    entry.breakdown = { collateral: values.collateral.toString(), debt: values.debt.toString(), netValue: values.netValue.toString() };
  } catch (error) { entry.errors.push(`breakdown: ${errorMessage(error)}`); }
  protocols.push(entry);
}

let globalHealth = null;
try {
  const result = await manager.getGlobalHealthFactor();
  globalHealth = result.lowestHF === ethers.MaxUint256
    ? { status: 'not-applicable', reason: 'No finite borrowing health factor was reported.' }
    : { status: 'reported', raw: result.lowestHF.toString(), protocol: result.protocolName };
}
catch (error) { globalHealth = { error: errorMessage(error) }; }
const report = { checkedAt: new Date().toISOString(), deployment: DEPLOYMENT.id, activeCount: Number(await manager.getActiveProtocolCount()), globalHealth, protocols };

if (isJsonMode()) console.log(jsonStringify(report));
else {
  console.log(`Protocols for ${report.deployment}; active count ${report.activeCount}`);
  console.table(protocols.map((entry) => ({ name: entry.name, active: entry.info?.isActive ?? 'unavailable', plugin: entry.info?.plugin ?? 'unavailable', lens: entry.info?.lensAdapter ?? 'unavailable', netRaw: entry.breakdown?.netValue ?? 'unavailable', errors: entry.errors.join('; ') })));
  console.log('Global health:', globalHealth);
}
