import { OperationError, serializeError } from "./errors";
import type { ConfirmedCall, ExecutionPlan, OperationResult, ScriptRuntime, TransactionResult } from "./types";

interface SnapshotProvider {
  send(method: string, params: readonly unknown[]): Promise<unknown>;
}

export async function executePlan(runtime: ScriptRuntime, plan: ExecutionPlan): Promise<OperationResult<undefined>> {
  const transactions: TransactionResult[] = [];
  let simulationSnapshot: string | undefined;
  try {
    if (plan.chainId !== runtime.chainId) throw new OperationError("Plan chainId mismatch", { plan: plan.chainId, runtime: runtime.chainId });
    if (runtime.options.encodeOnly || !runtime.options.execute) {
      return {
        success: true,
        operation: plan.operation,
        plan,
        transactions: plan.calls.map(call => ({ callId: call.id, simulated: false, status: "planned" })),
      };
    }
    if (!runtime.signer) throw new OperationError("Execution requires a signer");
    if (runtime.options.dryRun && plan.calls.length > 1) {
      try {
        simulationSnapshot = await (runtime.provider as unknown as SnapshotProvider).send("evm_snapshot", []) as string;
      } catch {
        throw new OperationError("Multi-call dry-run requires a local/fork provider with snapshot support");
      }
    }
    const completed = new Set<string>();
    let nextNonce = !runtime.options.dryRun || simulationSnapshot
      ? await runtime.provider.getTransactionCount(runtime.signerAddress as string, "pending")
      : undefined;
    for (const call of plan.calls) {
      if (call.dependsOn.some(id => !completed.has(id))) throw new OperationError("Unmet call dependency", { callId: call.id });
      const request = { to: call.target, data: call.data, value: BigInt(call.value) };
      if (runtime.options.dryRun) {
        if (simulationSnapshot) {
          const tx = await runtime.signer.sendTransaction({ ...request, nonce: nextNonce });
          const receipt = await tx.wait(runtime.options.confirmations);
          if (!receipt || receipt.status !== 1) throw new OperationError("Simulated transaction reverted", { callId: call.id });
          nextNonce = (nextNonce as number) + 1;
        } else {
          await runtime.provider.call({ ...request, from: runtime.signerAddress });
        }
        transactions.push({ callId: call.id, simulated: true, status: "simulated" });
      } else {
        const tx = await runtime.signer.sendTransaction({ ...request, nonce: nextNonce });
        nextNonce = (nextNonce as number) + 1;
        const receipt = await tx.wait(runtime.options.confirmations);
        if (!receipt || receipt.status !== 1) throw new OperationError("Transaction was not confirmed successfully", { callId: call.id, hash: tx.hash });
        transactions.push({
          callId: call.id,
          simulated: false,
          transactionHash: tx.hash as `0x${string}`,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          status: "confirmed",
        });
      }
      completed.add(call.id);
    }
    return { success: true, operation: plan.operation, plan, transactions };
  } catch (error) {
    return { success: false, operation: plan.operation, plan, transactions, error: serializeError(error) };
  } finally {
    if (simulationSnapshot !== undefined) await (runtime.provider as unknown as SnapshotProvider).send("evm_revert", [simulationSnapshot]);
  }
}

export async function executeSingleCall(runtime: ScriptRuntime, plan: ExecutionPlan): Promise<ConfirmedCall> {
  const result = await executePlan(runtime, plan);
  if (!result.success || result.transactions.length !== 1) throw new OperationError(result.error?.message ?? "Single call execution failed");
  return { result: result.transactions[0] };
}
