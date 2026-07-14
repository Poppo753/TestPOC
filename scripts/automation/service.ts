import fs from "fs";
import path from "path";
import type { VaultAutomationController } from "./controller";
import type { AutomationConfig, AutomationRunState, AutomationServiceHeartbeat } from "./types";

const FAILURE_STATES = new Set<AutomationRunState>(["SIMULATION_FAILED", "EXECUTION_FAILED", "VERIFICATION_FAILED", "FAILED"]);

export function writeServiceHeartbeat(filePath: string, heartbeat: AutomationServiceHeartbeat): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(heartbeat, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.renameSync(temporary, filePath);
}

export function readServiceHeartbeat(filePath: string): AutomationServiceHeartbeat {
  if (!fs.existsSync(filePath)) throw new Error(`Service heartbeat ${filePath} does not exist`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as AutomationServiceHeartbeat;
}

export interface ServiceOptions { allowPersistentExecution: boolean; signal?: AbortSignal; }

/** Single-vault service loop. Process supervision/restart remains an OS concern. */
export async function runAutomationService(controller: VaultAutomationController, config: AutomationConfig, options: ServiceOptions): Promise<void> {
  const startedAt = new Date().toISOString();
  let failures = 0;
  let lastRunId: string | undefined;
  let lastRunState: AutomationRunState | undefined;
  const heartbeat = (state: AutomationServiceHeartbeat["state"], lastError?: string) => writeServiceHeartbeat(config.runtime.heartbeatPath, {
    schemaVersion: 1, vaultId: config.vaultId, pid: process.pid, state, startedAt, updatedAt: new Date().toISOString(),
    lastRunId, lastRunState, consecutiveFailures: failures, lastError,
  });
  heartbeat("ready");
  try {
    while (!options.signal?.aborted) {
      heartbeat("running");
      let run;
      try {
        run = await controller.runCycle({ allowPersistentExecution: options.allowPersistentExecution });
        lastRunId = run.id; lastRunState = run.state;
        failures = FAILURE_STATES.has(run.state) ? failures + 1 : 0;
      } catch (error) {
        failures++;
        const message = error instanceof Error ? error.message : String(error);
        heartbeat("failed", message);
        if (failures >= config.runtime.maxConsecutiveFailures) throw new Error(`Automation service reached ${failures} consecutive failures: ${message}`);
      }
      if (failures >= config.runtime.maxConsecutiveFailures) {
        const message = `Automation service reached ${failures} consecutive failed runs`;
        heartbeat("failed", message); throw new Error(message);
      }
      heartbeat("waiting");
      if (options.signal?.aborted) break;
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, config.runtime.intervalSeconds * 1000);
        options.signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    heartbeat("stopped");
  } catch (error) {
    heartbeat("failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
