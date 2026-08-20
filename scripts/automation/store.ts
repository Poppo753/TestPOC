import fs from "fs";
import path from "path";
import type { AutomationRun, AutomationRunState, RunSummary } from "./types";

const TERMINAL_STATES = new Set<AutomationRunState>(["OBSERVED_ONLY", "NO_ACTION", "REJECTED", "SIMULATION_FAILED", "STALE", "EXECUTION_FAILED", "COMPLETED", "VERIFICATION_FAILED", "FAILED", "CANCELLED"]);

const TRANSITIONS: Record<AutomationRunState, AutomationRunState[]> = {
  CREATED: ["OBSERVED", "FAILED", "CANCELLED"],
  OBSERVED: ["OBSERVED_ONLY", "NO_ACTION", "VALIDATED", "REJECTED", "FAILED", "CANCELLED"],
  OBSERVED_ONLY: [],
  NO_ACTION: [],
  VALIDATED: ["PLANNED", "FAILED", "CANCELLED"],
  REJECTED: [],
  PLANNED: ["AWAITING_SAFE_PROPOSAL", "SIMULATED", "SIMULATION_FAILED", "FAILED", "CANCELLED"],
  AWAITING_SAFE_PROPOSAL: ["AWAITING_APPROVAL", "SIMULATION_FAILED", "FAILED", "CANCELLED"],
  SIMULATED: ["AWAITING_APPROVAL", "APPROVED", "FAILED", "CANCELLED"],
  SIMULATION_FAILED: [],
  AWAITING_APPROVAL: ["APPROVED", "EXECUTION_FAILED", "VERIFYING", "FAILED", "CANCELLED"],
  APPROVED: ["STALE", "EXECUTING", "FAILED", "CANCELLED"],
  STALE: [],
  EXECUTING: ["EXECUTION_FAILED", "VERIFYING", "FAILED"],
  EXECUTION_FAILED: [],
  VERIFYING: ["COMPLETED", "VERIFICATION_FAILED", "FAILED"],
  COMPLETED: [],
  VERIFICATION_FAILED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isTerminalState(state: AutomationRunState): boolean { return TERMINAL_STATES.has(state); }

export function assertTransition(from: AutomationRunState, to: AutomationRunState): void {
  if (!TRANSITIONS[from].includes(to)) throw new Error(`Invalid automation transition ${from} -> ${to}`);
}

export interface VaultLock { release(): void; }

/**
 * Single-host durable store. Atomic rename prevents half-written JSON; the
 * exclusive lock file prevents two processes from acting on one vault.
 */
export class JsonAutomationStore {
  private readonly runsDirectory: string;
  private readonly locksDirectory: string;

  constructor(private readonly rootDirectory: string) {
    this.runsDirectory = path.join(rootDirectory, "runs");
    this.locksDirectory = path.join(rootDirectory, "locks");
    fs.mkdirSync(this.runsDirectory, { recursive: true });
    fs.mkdirSync(this.locksDirectory, { recursive: true });
  }

  private runPath(id: string): string {
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error("Invalid run id");
    return path.join(this.runsDirectory, `${id}.json`);
  }

  private writeAtomic(filePath: string, value: unknown): void {
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, filePath);
  }

  create(run: AutomationRun): AutomationRun {
    const filePath = this.runPath(run.id);
    if (fs.existsSync(filePath)) throw new Error(`Run ${run.id} already exists`);
    this.writeAtomic(filePath, run);
    return run;
  }

  get(id: string): AutomationRun {
    const filePath = this.runPath(id);
    if (!fs.existsSync(filePath)) throw new Error(`Run ${id} does not exist`);
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as AutomationRun;
  }

  save(run: AutomationRun): AutomationRun {
    if (!fs.existsSync(this.runPath(run.id))) throw new Error(`Run ${run.id} does not exist`);
    run.updatedAt = new Date().toISOString();
    this.writeAtomic(this.runPath(run.id), run);
    return run;
  }

  transition(id: string, to: AutomationRunState, note?: string, mutate?: (run: AutomationRun) => void): AutomationRun {
    const run = this.get(id);
    assertTransition(run.state, to);
    const at = new Date().toISOString();
    run.transitions.push({ from: run.state, to, at, note });
    run.state = to;
    run.updatedAt = at;
    mutate?.(run);
    return this.save(run);
  }

  list(vaultId?: string): RunSummary[] {
    return fs.readdirSync(this.runsDirectory).filter(name => name.endsWith(".json")).map(name => JSON.parse(fs.readFileSync(path.join(this.runsDirectory, name), "utf8")) as AutomationRun)
      .filter(run => !vaultId || run.vaultId === vaultId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(run => ({ id: run.id, state: run.state, mode: run.mode, createdAt: run.createdAt, updatedAt: run.updatedAt }));
  }

  latestCompleted(vaultId: string): AutomationRun | undefined {
    const item = this.list(vaultId).find(run => run.state === "COMPLETED");
    return item ? this.get(item.id) : undefined;
  }

  /** A single vault may have only one unfinished economic intention at a time. */
  latestOpen(vaultId: string): AutomationRun | undefined {
    const item = this.list(vaultId).find(run => !isTerminalState(run.state));
    return item ? this.get(item.id) : undefined;
  }

  acquireLock(vaultId: string, ttlSeconds: number): VaultLock {
    if (!/^[a-zA-Z0-9._-]+$/.test(vaultId)) throw new Error("Invalid vault id");
    const lockPath = path.join(this.locksDirectory, `${vaultId}.lock`);
    if (fs.existsSync(lockPath)) {
      const stat = fs.statSync(lockPath);
      if (Date.now() - stat.mtimeMs <= ttlSeconds * 1000) throw new Error(`Vault ${vaultId} is already locked`);
      fs.unlinkSync(lockPath); // Explicit stale-lock recovery after the configured TTL.
    }
    const descriptor = fs.openSync(lockPath, "wx");
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    fs.writeFileSync(descriptor, JSON.stringify({ token, pid: process.pid, acquiredAt: new Date().toISOString() }));
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        fs.closeSync(descriptor);
        // A stale-lock recovery may have replaced this file. Never delete a
        // newer worker's lock when the original long-running worker exits.
        if (fs.existsSync(lockPath)) {
          try {
            const current = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { token?: string };
            if (current.token === token) fs.unlinkSync(lockPath);
          } catch { /* Preserve an unreadable/replaced lock for operator inspection. */ }
        }
      },
    };
  }
}
