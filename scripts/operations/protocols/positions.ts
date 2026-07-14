import { PROTOCOL_MANAGER_ABI } from "../../framework/abis";
import { readContract } from "../../framework/contracts";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertOwner, assertPositive } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ProtocolOperation, ScriptRuntime } from "../../framework/types";

export interface ProtocolActionInput {
  operation: ProtocolOperation;
  protocolName: string;
  tokenCode?: string;
  amount?: bigint;
  debtTokenCode?: string;
  collateralTokenCode?: string;
}

export async function executeProtocolAction(runtime: ScriptRuntime, input: ProtocolActionInput): Promise<OperationResult<undefined>> {
  const manager = contractAddress(runtime.manifest, "protocolManager");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, manager);
  const info = await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getProtocolInfo", [input.protocolName]);
  const record = info[0] as { isActive?: boolean };
  if (record.isActive === false) throw new Error(`Protocol ${input.protocolName} is inactive`);
  let method: string;
  let args: readonly unknown[];
  if (input.operation === "close") {
    if (!input.debtTokenCode || !input.collateralTokenCode) throw new Error("close requires debtTokenCode and collateralTokenCode");
    method = "closePosition(string,string,string)";
    args = [input.protocolName, input.debtTokenCode, input.collateralTokenCode];
  } else {
    if (!input.tokenCode) throw new Error(`${input.operation} requires tokenCode`);
    const amount = input.amount ?? 0n;
    if (input.operation !== "repay" || amount !== 0n) assertPositive(amount);
    method = `${input.operation}(string,string,uint256)`;
    args = [input.protocolName, input.tokenCode, amount];
  }
  const call = buildCall({ id: `protocol-${input.operation}`, description: `${input.operation} on ${input.protocolName}`,
    chainId: runtime.chainId, target: manager, abi: PROTOCOL_MANAGER_ABI, method, args });
  return executePlan(runtime, buildPlan(`protocol.${input.operation}`, runtime.chainId, [call]));
}

export async function readProtocolPosition(runtime: ScriptRuntime, protocolName: string, tokenCode: string) {
  const manager = contractAddress(runtime.manifest, "protocolManager");
  const balance = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getBalance", [protocolName, tokenCode]))[0] as bigint;
  const debt = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getDebt", [protocolName, tokenCode]))[0] as bigint;
  const healthFactor = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getHealthFactor", [protocolName]))[0] as bigint;
  return { protocolName, tokenCode, balance: balance.toString(), debt: debt.toString(), healthFactor: healthFactor.toString() };
}

