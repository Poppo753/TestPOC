import { Interface, isAddress } from "ethers";
import { PreflightError } from "./errors";
import type { Address, ScriptRuntime } from "./types";

export function assertAllowedChain(runtime: ScriptRuntime): void {
  if (!runtime.options.allowedChainIds.includes(runtime.chainId)) {
    throw new PreflightError("Current chain is not allowed", { chainId: runtime.chainId, allowed: runtime.options.allowedChainIds });
  }
}

export async function assertContract(runtime: ScriptRuntime, address: string, label: string): Promise<Address> {
  if (!isAddress(address)) throw new PreflightError(`${label} is not a valid address`, { address });
  const code = await runtime.provider.getCode(address);
  if (code === "0x") throw new PreflightError(`${label} has no bytecode on chain ${runtime.chainId}`, { address });
  return address as Address;
}

export async function assertSigner(runtime: ScriptRuntime, minimumBalance = 0n): Promise<Address> {
  if (!runtime.signer || !runtime.signerAddress) throw new PreflightError("This operation requires a signer");
  const balance = await runtime.provider.getBalance(runtime.signerAddress);
  if (balance < minimumBalance) throw new PreflightError("Signer has insufficient native balance", { balance: balance.toString(), minimumBalance: minimumBalance.toString() });
  return runtime.signerAddress;
}

export async function assertOwner(runtime: ScriptRuntime, contract: string): Promise<void> {
  const signer = await assertSigner(runtime);
  const iface = new Interface(["function owner() view returns (address)"]);
  const raw = await runtime.provider.call({ to: contract, data: iface.encodeFunctionData("owner") });
  const owner = iface.decodeFunctionResult("owner", raw)[0] as string;
  if (owner.toLowerCase() !== signer.toLowerCase()) throw new PreflightError("Signer is not contract owner", { contract, owner, signer });
}

export function assertPositive(amount: bigint, label = "amount"): void {
  if (amount <= 0n) throw new PreflightError(`${label} must be greater than zero`, { amount: amount.toString() });
}

