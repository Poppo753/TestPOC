/**
 * Vault Automation Controller CLI.
 *
 * Read/planning commands are safe by default. A persistent execution is
 * accepted only when BOTH --execute=true and --dry-run=false are present.
 */
import fs from "fs";
import hre from "hardhat";
import { cliBoolean, cliString, parseCliArguments, stringifyForOutput } from "../framework/cli";
import { loadManifest } from "../framework/manifest";
import { createRuntime } from "../framework/runtime";
import { loadAutomationConfig } from "./config";
import { VaultAutomationController } from "./controller";
import { runAutomationPreflight } from "./preflight";
import { OfficialSafeAdapter } from "./safe";
import { readServiceHeartbeat, runAutomationService } from "./service";
import { isTerminalState, JsonAutomationStore } from "./store";
import type { AutomationRun } from "./types";

function required(args: ReturnType<typeof parseCliArguments>, key: string): string {
  return cliString(args, key, true) as string;
}

function runForConfig(store: JsonAutomationStore, runId: string, vaultId: string): AutomationRun {
  const run = store.get(runId);
  if (run.vaultId !== vaultId) throw new Error(`Run ${runId} belongs to vault ${run.vaultId}, not ${vaultId}`);
  return run;
}

async function main(): Promise<unknown> {
  const command = process.argv[2];
  if (!command) throw new Error("Missing command: preflight, run, loop, service-status, list, show, approve, cancel, execute, export, safe-propose or safe-sync");
  const args = parseCliArguments(process.argv.slice(3));
  const config = loadAutomationConfig(required(args, "config"));
  const store = new JsonAutomationStore(config.runtime.stateDirectory);
  if (command === "service-status") return readServiceHeartbeat(config.runtime.heartbeatPath);
  if (command === "list") return store.list(config.vaultId);
  if (command === "show") return runForConfig(store, required(args, "run-id"), config.vaultId);
  if (command === "export") {
    const run = runForConfig(store, required(args, "run-id"), config.vaultId);
    if (!run.plan) throw new Error("Run has no ExecutionPlan to export");
    const output = required(args, "output");
    fs.writeFileSync(output, `${stringifyForOutput(run.plan)}\n`, { encoding: "utf8", flag: "wx" });
    return { success: true, output, runId: run.id };
  }
  if (command === "approve") {
    if (config.execution.kind === "safe") throw new Error("Safe runs cannot be approved with a text label; use safe-propose and safe-sync");
    const lock = store.acquireLock(config.vaultId, config.runtime.lockTtlSeconds);
    try {
      const runId = required(args, "run-id"); const approvedBy = required(args, "approved-by"); const run = runForConfig(store, runId, config.vaultId);
      if (run.state !== "AWAITING_APPROVAL") throw new Error(`Run ${runId} is not awaiting approval`);
      return store.transition(runId, "APPROVED", "Explicit operator approval", record => { record.approvedAt = new Date().toISOString(); record.approvedBy = approvedBy; });
    } finally { lock.release(); }
  }
  if (command === "cancel") {
    const lock = store.acquireLock(config.vaultId, config.runtime.lockTtlSeconds);
    try {
      const runId = required(args, "run-id"); const run = runForConfig(store, runId, config.vaultId);
      if (isTerminalState(run.state)) throw new Error(`Run ${runId} is already terminal`);
      return store.transition(runId, "CANCELLED", required(args, "reason"), record => { record.cancelledAt = new Date().toISOString(); });
    } finally { lock.release(); }
  }
  const manifest = loadManifest(config.manifestPath);
  const directWorkflow = config.execution.kind === "direct" && config.mode !== "observe" && ["preflight", "execute", "run", "loop"].includes(command);
  const signerRequired = directWorkflow || command === "safe-propose";
  let explicitSigner;
  if (hre.network.name === "hardhat" && process.env.FORK_ENABLED === "true" && signerRequired) {
    const address = config.runtime.simulationImpersonateAddress;
    if (!address) throw new Error("Fork advisory/autonomous simulation requires runtime.simulationImpersonateAddress");
    await hre.ethers.provider.send("hardhat_impersonateAccount", [address]);
    await hre.ethers.provider.send("hardhat_setBalance", [address, "0x56BC75E2D63100000"]); // 100 ETH for simulated gas.
    explicitSigner = await hre.ethers.getSigner(address);
  }
  const runtime = await createRuntime(hre, {
    manifest,
    signer: explicitSigner,
    requireSigner: signerRequired,
    options: { execute: false, dryRun: true, encodeOnly: false, confirmations: config.runtime.confirmations,
      rpcRetries: config.runtime.rpcRetries, rpcRetryDelayMs: config.runtime.rpcRetryDelayMs },
  });
  const controller = new VaultAutomationController(runtime, config, store);
  const persistent = cliBoolean(args, "execute", false) && !cliBoolean(args, "dry-run", true);
  if (command === "preflight") {
    const report = await runAutomationPreflight(runtime, config);
    if (!report.ready) process.exitCode = 2;
    return report;
  }
  if (command === "safe-propose") {
    const runId = required(args, "run-id");
    const adapter = new OfficialSafeAdapter();
    const prepared = await adapter.prepareAndPropose(runtime, config, controller.get(runId));
    return controller.bindSafeProposal(runId, prepared.binding, prepared.simulationPassed);
  }
  if (command === "safe-sync") {
    const runId = required(args, "run-id");
    const run = controller.get(runId);
    if (!run.safe) throw new Error(`Run ${runId} has no Safe proposal binding`);
    const status = await new OfficialSafeAdapter().getExecutionStatus(config, run.safe);
    return controller.reconcileSafeExecution(runId, status);
  }
  if (command === "execute") {
    if (!persistent) throw new Error("Persistent execution requires --execute=true --dry-run=false");
    return controller.executeApproved(required(args, "run-id"), true);
  }
  if (command === "run") return controller.runCycle({ allowPersistentExecution: persistent });
  if (command === "loop") {
    const report = await runAutomationPreflight(runtime, config);
    if (!report.ready) throw new Error(`Service preflight failed: ${report.checks.filter(item => item.status === "FAIL").map(item => item.id).join(", ")}`);
    const abort = new AbortController();
    process.once("SIGINT", () => abort.abort()); process.once("SIGTERM", () => abort.abort());
    await runAutomationService(controller, config, { allowPersistentExecution: persistent, signal: abort.signal });
    return { success: true, stopped: true };
  }
  throw new Error(`Unknown automation command: ${command}`);
}

main().then(result => process.stdout.write(`${stringifyForOutput(result)}\n`)).catch(error => {
  process.stderr.write(`${stringifyForOutput({ success: false, error: { message: error instanceof Error ? error.message : String(error) } })}\n`);
  process.exitCode = 1;
});
