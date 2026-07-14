import type { ScriptRuntime } from "../framework/types";
import { executePlan } from "../framework/transactions";
import { hashValue } from "./config";
import { JsonConsoleEventSink, type EventSink } from "./alerts";
import { observeVault } from "./observer";
import { buildRebalancePlan } from "./planner";
import { evaluateRisk } from "./risk";
import { evaluateStrategy } from "./strategy";
import { isTerminalState, JsonAutomationStore } from "./store";
import type { AutomationConfig, AutomationEvent, AutomationRun, AutomationRunState, SafeExecutionStatus, SafeProposalBinding } from "./types";
import { verifyRebalance } from "./verifier";

export interface CycleOptions { allowPersistentExecution?: boolean; }

function absoluteDifference(a: bigint, b: bigint): bigint { return a > b ? a - b : b - a; }

/**
 * Interest-bearing balances can move by a few wei between approval and send.
 * Structural changes are always stale; numeric drift is bounded by policy and
 * the original decision is run through the risk engine again before sending.
 */
export function observationsMateriallyDiffer(before: AutomationRun["observation"], current: AutomationRun["observation"], maxDriftBps: number): boolean {
  if (!before || !current) return true;
  if (before.vaultId !== current.vaultId || before.chainId !== current.chainId || before.baseAssetCode !== current.baseAssetCode) return true;
  if (before.paused !== current.paused || before.depositsEnabled !== current.depositsEnabled || before.withdrawsEnabled !== current.withdrawsEnabled) return true;
  const denominator = BigInt(before.managedAssets) || 1n;
  const material = (a: string, b: string) => absoluteDifference(BigInt(a), BigInt(b)) * 10_000n > denominator * BigInt(maxDriftBps);
  if (material(before.managedAssets, current.managedAssets) || material(before.custodyBalance, current.custodyBalance)) return true;
  if (before.protocols.length !== current.protocols.length) return true;
  for (const oldProtocol of before.protocols) {
    const next = current.protocols.find(item => item.name === oldProtocol.name);
    if (!next || oldProtocol.active !== next.active || oldProtocol.circuitBreakerActive !== next.circuitBreakerActive || oldProtocol.debt !== next.debt) return true;
    if (material(oldProtocol.balance, next.balance)) return true;
  }
  return false;
}

export class VaultAutomationController {
  constructor(
    private readonly runtime: ScriptRuntime,
    private readonly config: AutomationConfig,
    private readonly store = new JsonAutomationStore(config.runtime.stateDirectory),
    private readonly eventSink: EventSink = new JsonConsoleEventSink(),
  ) {}

  private async event(run: AutomationRun, level: AutomationEvent["level"], type: string, message: string, context?: Record<string, unknown>): Promise<void> {
    const event: AutomationEvent = { at: new Date().toISOString(), level, type, runId: run.id, vaultId: run.vaultId, message, context };
    run.events.push(event);
    this.store.save(run);
    await this.eventSink.emit(event);
  }

  private transition(run: AutomationRun, state: AutomationRunState, note?: string, mutate?: (record: AutomationRun) => void): AutomationRun {
    return this.store.transition(run.id, state, note, mutate);
  }

  private createRun(): AutomationRun {
    const now = new Date().toISOString();
    const id = `${this.config.vaultId}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    return this.store.create({ schemaVersion: 1, id, vaultId: this.config.vaultId, chainId: this.config.chainId, configHash: hashValue(this.config), mode: this.config.mode,
      state: "CREATED", createdAt: now, updatedAt: now, transitions: [{ to: "CREATED", at: now }], events: [] });
  }

  /** Execute one complete decision cycle. The vault lock is always released. */
  async runCycle(options: CycleOptions = {}): Promise<AutomationRun> {
    const lock = this.store.acquireLock(this.config.vaultId, this.config.runtime.lockTtlSeconds);
    let run: AutomationRun | undefined;
    try {
      const open = this.store.latestOpen(this.config.vaultId);
      if (open) return open;
      run = this.createRun();
      await this.event(run, "info", "CYCLE_STARTED", "Automation cycle started");
      const observation = await observeVault(this.runtime, this.config);
      run = this.transition(run, "OBSERVED", undefined, record => { record.observation = observation; });
      const lastCompleted = this.store.latestCompleted(this.config.vaultId);
      const decision = evaluateStrategy(this.config, observation, { lastCompletedAt: lastCompleted?.updatedAt });
      run.decision = decision; this.store.save(run);
      if (decision.kind === "NO_ACTION") {
        run = this.transition(run, "NO_ACTION", decision.reason);
        await this.event(run, "info", "NO_ACTION", decision.reason);
        return run;
      }
      if (this.config.mode === "observe") {
        run = this.transition(run, "OBSERVED_ONLY", "Observe mode records but does not simulate or execute");
        await this.event(run, "info", "DECISION_OBSERVED", decision.reason);
        return run;
      }
      const risk = evaluateRisk(this.config, observation, decision);
      run.risk = risk; this.store.save(run);
      if (!risk.approved) {
        run = this.transition(run, "REJECTED", "Risk engine rejected decision");
        await this.event(run, "critical", "RISK_REJECTED", "Risk engine rejected decision", { findings: risk.findings });
        return run;
      }
      run = this.transition(run, "VALIDATED");
      const plan = buildRebalancePlan(this.runtime, decision);
      run = this.transition(run, "PLANNED", undefined, record => { record.plan = plan; });
      if (this.config.execution.kind === "safe") {
        run = this.transition(run, "AWAITING_SAFE_PROPOSAL", "Safe batch must be built and simulated by the official Safe Protocol Kit");
        await this.event(run, "warning", "AWAITING_SAFE_PROPOSAL", "Plan is ready for Safe batch preparation and simulation");
        return run;
      }
      const simulationRuntime = { ...this.runtime, options: { ...this.runtime.options, execute: true, dryRun: true, encodeOnly: false } };
      const simulation = await executePlan(simulationRuntime, plan);
      if (!simulation.success) {
        run = this.transition(run, "SIMULATION_FAILED", simulation.error?.message, record => { record.simulation = simulation; });
        await this.event(run, "critical", "SIMULATION_FAILED", simulation.error?.message ?? "Simulation failed");
        return run;
      }
      run = this.transition(run, "SIMULATED", undefined, record => { record.simulation = simulation; });
      if (this.config.mode === "advisory") {
        run = this.transition(run, "AWAITING_APPROVAL", "Plan requires explicit operator approval");
        await this.event(run, "warning", "AWAITING_APPROVAL", "A simulated plan is awaiting approval");
        return run;
      }
      run = this.transition(run, "APPROVED", "Autonomous policy approval", record => { record.approvedAt = new Date().toISOString(); record.approvedBy = "autonomous-policy"; });
      if (!options.allowPersistentExecution) {
        await this.event(run, "warning", "EXECUTION_GATE_CLOSED", "Autonomous plan approved but persistent execution flags were not supplied");
        return run;
      }
      return this.executeApproved(run.id, true, true);
    } catch (error) {
      if (!run) throw error;
      run = this.store.get(run.id);
      if (!isTerminalState(run.state)) run = this.transition(run, "FAILED", "Unexpected controller failure", record => { record.failure = { message: error instanceof Error ? error.message : String(error) }; });
      await this.event(run, "critical", "CYCLE_FAILED", error instanceof Error ? error.message : String(error));
      return run;
    } finally {
      lock.release();
    }
  }

  approve(runId: string, approvedBy: string): AutomationRun {
    const lock = this.store.acquireLock(this.config.vaultId, this.config.runtime.lockTtlSeconds);
    try {
      const run = this.store.get(runId);
      this.assertRunContext(run);
      if (run.state !== "AWAITING_APPROVAL") throw new Error(`Run ${runId} is not awaiting approval`);
      return this.transition(run, "APPROVED", "Explicit operator approval", record => { record.approvedAt = new Date().toISOString(); record.approvedBy = approvedBy; });
    } finally { lock.release(); }
  }

  cancel(runId: string, reason: string): AutomationRun {
    const lock = this.store.acquireLock(this.config.vaultId, this.config.runtime.lockTtlSeconds);
    try {
      const run = this.store.get(runId);
      this.assertRunContext(run);
      if (isTerminalState(run.state)) throw new Error(`Run ${runId} is already terminal`);
      return this.transition(run, "CANCELLED", reason, record => { record.cancelledAt = new Date().toISOString(); });
    } finally { lock.release(); }
  }

  private assertRunContext(run: AutomationRun): void {
    if (run.vaultId !== this.config.vaultId || run.chainId !== this.config.chainId) throw new Error(`Run ${run.id} does not belong to configured vault and chain`);
  }

  /**
   * Execute only a previously approved, fresh plan. `persistentGate` must be
   * true and CLI additionally requires --execute=true --dry-run=false.
   */
  async executeApproved(runId: string, persistentGate: boolean, lockAlreadyHeld = false): Promise<AutomationRun> {
    if (!persistentGate) throw new Error("Persistent execution gate is closed");
    if (this.config.execution.kind !== "direct") throw new Error("Direct execution is disabled by execution.kind");
    if (!this.runtime.signerAddress || this.runtime.signerAddress.toLowerCase() !== this.config.execution.expectedSignerAddress?.toLowerCase()) {
      throw new Error("Runtime signer does not match execution.expectedSignerAddress");
    }
    const lock = lockAlreadyHeld ? undefined : this.store.acquireLock(this.config.vaultId, this.config.runtime.lockTtlSeconds);
    let run: AutomationRun | undefined;
    try {
      run = this.store.get(runId);
      if (run.state !== "APPROVED" || !run.plan || !run.observation || !run.decision) throw new Error(`Run ${runId} is not an executable approved plan`);
      if (run.vaultId !== this.config.vaultId || run.chainId !== this.config.chainId || run.configHash !== hashValue(this.config)) {
        run = this.transition(run, "STALE", "Vault, chain or automation configuration changed after planning");
        await this.event(run, "warning", "PLAN_STALE", "Approved plan belongs to a different or changed configuration");
        return run;
      }
      // Capture narrowed immutable inputs before state transitions reload the record.
      const approvedPlan = run.plan;
      const approvedObservation = run.observation;
      const approvedDecision = run.decision;
      const current = await observeVault(this.runtime, this.config);
      const blockAge = current.blockNumberEnd - approvedObservation.blockNumberEnd;
      const currentRisk = evaluateRisk(this.config, current, approvedDecision);
      if (blockAge < 0 || blockAge > this.config.policy.maxPlanAgeBlocks || observationsMateriallyDiffer(approvedObservation, current, this.config.policy.maxStateDriftBps) || !currentRisk.approved) {
        run = this.transition(run, "STALE", "Block age or economic state changed before execution");
        await this.event(run, "warning", "PLAN_STALE", "Approved plan was invalidated before execution", { blockAge, findings: currentRisk.findings });
        return run;
      }
      run = this.transition(run, "EXECUTING");
      const executionRuntime = { ...this.runtime, options: { ...this.runtime.options, execute: true, dryRun: false, encodeOnly: false, confirmations: this.config.runtime.confirmations } };
      const execution = await executePlan(executionRuntime, approvedPlan);
      if (!execution.success) {
        run = this.transition(run, "EXECUTION_FAILED", execution.error?.message, record => { record.execution = execution; });
        await this.event(run, "critical", "EXECUTION_FAILED", execution.error?.message ?? "Execution failed");
        return run;
      }
      run = this.transition(run, "VERIFYING", undefined, record => { record.execution = execution; });
      const after = await observeVault(this.runtime, this.config);
      const verification = verifyRebalance(this.config, approvedObservation, after, approvedDecision);
      run.verification = verification; this.store.save(run);
      if (!verification.passed) {
        run = this.transition(run, "VERIFICATION_FAILED", "Transactions confirmed but post-state verification failed");
        await this.event(run, "critical", "VERIFICATION_FAILED", "Post-state verification failed", { findings: verification.findings });
        return run;
      }
      run = this.transition(run, "COMPLETED");
      await this.event(run, "info", "CYCLE_COMPLETED", "Rebalance completed and verified");
      return run;
    } catch (error) {
      if (!run) throw error;
      run = this.store.get(run.id);
      if (!isTerminalState(run.state)) {
        const target = run.state === "EXECUTING" ? "EXECUTION_FAILED" : "FAILED";
        run = this.transition(run, target, "Unexpected execution workflow failure", record => { record.failure = { message: error instanceof Error ? error.message : String(error) }; });
      }
      await this.event(run, "critical", "EXECUTION_WORKFLOW_FAILED", error instanceof Error ? error.message : String(error));
      return run;
    } finally {
      lock?.release();
    }
  }

  get(runId: string): AutomationRun { return this.store.get(runId); }
  list() { return this.store.list(this.config.vaultId); }

  /** Persist an exact Safe proposal only after the official service estimates the call-only batch successfully. */
  async bindSafeProposal(runId: string, binding: SafeProposalBinding, simulationPassed: boolean): Promise<AutomationRun> {
    const lock = this.store.acquireLock(this.config.vaultId, this.config.runtime.lockTtlSeconds);
    try {
      let run = this.store.get(runId);
      this.assertRunContext(run);
      if (run.configHash !== hashValue(this.config)) throw new Error("Automation configuration changed before Safe proposal");
      if (this.config.execution.kind !== "safe" || !this.config.safe) throw new Error("Safe execution is not configured");
      if (run.state !== "AWAITING_SAFE_PROPOSAL" || !run.plan) throw new Error(`Run ${runId} is not awaiting a Safe proposal`);
      if (binding.safeAddress.toLowerCase() !== this.config.safe.address.toLowerCase()) throw new Error("Safe proposal address differs from config");
      if (!simulationPassed) {
        run = this.transition(run, "SIMULATION_FAILED", "Safe Transaction Service rejected batch simulation");
        await this.event(run, "critical", "SIMULATION_FAILED", "Safe batch simulation failed");
        return run;
      }
      run = this.transition(run, "AWAITING_APPROVAL", "Safe transaction proposed; awaiting multisig execution", record => {
        record.safe = binding;
        record.simulation = {
          success: true,
          operation: record.plan?.operation ?? "automation.rebalance",
          plan: record.plan,
          transactions: record.plan?.calls.map(call => ({ callId: call.id, simulated: true, status: "simulated" })) ?? [],
        };
      });
      await this.event(run, "warning", "SAFE_PROPOSED", "Safe batch was simulated and proposed", { safeTxHash: binding.safeTxHash, nonce: binding.nonce });
      return run;
    } finally { lock.release(); }
  }

  /** Reconcile an externally executed Safe transaction and verify its economic post-state. */
  async reconcileSafeExecution(runId: string, status: SafeExecutionStatus): Promise<AutomationRun> {
    const lock = this.store.acquireLock(this.config.vaultId, this.config.runtime.lockTtlSeconds);
    try {
      let run = this.store.get(runId);
      this.assertRunContext(run);
      if (run.configHash !== hashValue(this.config)) throw new Error("Automation configuration changed before Safe reconciliation");
      if (run.state !== "AWAITING_APPROVAL" || !run.safe || !run.observation || !run.decision || !run.plan) throw new Error(`Run ${runId} has no pending Safe execution`);
      if (status.safeAddress.toLowerCase() !== run.safe.safeAddress.toLowerCase() || status.safeTxHash.toLowerCase() !== run.safe.safeTxHash.toLowerCase()) {
        throw new Error("Safe service response does not match bound proposal");
      }
      if (hashValue(status.transactionData) !== hashValue(run.safe.transactionData)) throw new Error("Safe transaction data differs from bound proposal");
      if (!status.trusted) throw new Error("Safe Transaction Service marked the proposal as untrusted");
      if (!status.executed) return run;
      if (!status.successful || !status.transactionHash) {
        run = this.transition(run, "EXECUTION_FAILED", "Safe transaction executed unsuccessfully");
        await this.event(run, "critical", "SAFE_EXECUTION_FAILED", "Safe transaction failed on-chain", { safeTxHash: status.safeTxHash });
        return run;
      }
      const receipt = await this.runtime.provider.getTransactionReceipt(status.transactionHash);
      if (!receipt || receipt.status !== 1) throw new Error("Successful Safe service response has no successful on-chain receipt");
      const transaction = await this.runtime.provider.getTransaction(status.transactionHash);
      if (!transaction?.to || transaction.to.toLowerCase() !== run.safe.safeAddress.toLowerCase()) throw new Error("Execution receipt does not target the bound Safe");
      const confirmations = (await this.runtime.provider.getBlockNumber()) - receipt.blockNumber + 1;
      if (confirmations < this.config.runtime.confirmations) return run;
      const approvedObservation = run.observation;
      const approvedDecision = run.decision;
      run = this.transition(run, "VERIFYING", "Safe execution confirmed on-chain", record => {
        record.approvedAt = record.safe?.proposedAt;
        record.approvedBy = record.safe?.safeTxHash;
        record.execution = {
          success: true,
          operation: record.plan?.operation ?? "automation.rebalance",
          plan: record.plan,
          transactions: [{ callId: "safe-batch", simulated: false, transactionHash: status.transactionHash as `0x${string}`, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), status: "confirmed" }],
        };
      });
      const after = await observeVault(this.runtime, this.config);
      const verification = verifyRebalance(this.config, approvedObservation, after, approvedDecision);
      run.verification = verification; this.store.save(run);
      if (!verification.passed) {
        run = this.transition(run, "VERIFICATION_FAILED", "Safe transaction confirmed but post-state verification failed");
        await this.event(run, "critical", "VERIFICATION_FAILED", "Safe post-state verification failed", { findings: verification.findings });
        return run;
      }
      run = this.transition(run, "COMPLETED", "Safe execution confirmed and verified");
      await this.event(run, "info", "CYCLE_COMPLETED", "Safe rebalance completed and verified", { safeTxHash: status.safeTxHash });
      return run;
    } finally { lock.release(); }
  }
}
