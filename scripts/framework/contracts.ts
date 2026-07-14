import { Interface } from "ethers";
import type { ScriptRuntime } from "./types";
import { withRpcRetry } from "./retry";

export async function readContract(
  runtime: ScriptRuntime,
  target: string,
  abi: readonly string[],
  method: string,
  args: readonly unknown[] = []
): Promise<readonly unknown[]> {
  const iface = new Interface(abi);
  const data = iface.encodeFunctionData(method, [...args]);
  const raw = await withRpcRetry(
    () => runtime.provider.call({ to: target, data }),
    { retries: runtime.options.rpcRetries ?? 3, delayMs: runtime.options.rpcRetryDelayMs ?? 250 },
  );
  return [...iface.decodeFunctionResult(method, raw)];
}

export async function readUint(runtime: ScriptRuntime, target: string, signature: string, args: readonly unknown[] = []): Promise<bigint> {
  const method = signature.slice("function ".length, signature.indexOf("("));
  return (await readContract(runtime, target, [signature], method, args))[0] as bigint;
}

export async function readBool(runtime: ScriptRuntime, target: string, signature: string, args: readonly unknown[] = []): Promise<boolean> {
  const method = signature.slice("function ".length, signature.indexOf("("));
  return (await readContract(runtime, target, [signature], method, args))[0] as boolean;
}
