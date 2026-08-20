import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { getAddress, isAddress } from "ethers";
import type { AutomationConfig } from "./types";

export const AUTONOMOUS_ACKNOWLEDGEMENT = "I_ACCEPT_LIMITED_AUTONOMOUS_EXECUTION";
const FORBIDDEN_SECRET_KEYS = new Set(["privatekey", "private_key", "mnemonic", "seedphrase", "seed_phrase"]);

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value as number;
}

function bigintString(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${name} must be a non-negative integer string`);
  BigInt(value);
  return value;
}

/** Validate at the boundary so strategy and executor never receive ambiguous policy. */
export function validateAutomationConfig(value: unknown): AutomationConfig {
  if (!value || typeof value !== "object") throw new Error("Automation config must be an object");
  const config = value as AutomationConfig;
  const rejectInlineSecrets = (item: unknown): void => {
    if (Array.isArray(item)) return item.forEach(rejectInlineSecrets);
    if (!item || typeof item !== "object") return;
    for (const [key, nested] of Object.entries(item as Record<string, unknown>)) {
      if (FORBIDDEN_SECRET_KEYS.has(key.toLowerCase())) throw new Error(`Secret field ${key} is forbidden in automation config`);
      rejectInlineSecrets(nested);
    }
  };
  rejectInlineSecrets(config);
  if (config.schemaVersion !== 1) throw new Error("Unsupported automation schemaVersion");
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(config.vaultId ?? "")) throw new Error("vaultId contains unsupported characters");
  integer(config.chainId, "chainId", 1, Number.MAX_SAFE_INTEGER);
  if (typeof config.manifestPath !== "string" || !config.manifestPath.trim()) throw new Error("manifestPath is required");
  if (!(["observe", "advisory", "autonomous"] as unknown[]).includes(config.mode)) throw new Error("mode must be observe, advisory or autonomous");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(config.baseAssetCode ?? "")) throw new Error("baseAssetCode is invalid");
  integer(config.baseAssetDecimals, "baseAssetDecimals", 0, 36);
  if (!Array.isArray(config.protocols) || config.protocols.length === 0) throw new Error("At least one protocol is required");
  const names = new Set<string>();
  let targetTotal = integer(config.policy?.reserveTargetBps, "policy.reserveTargetBps", 0, 10_000);
  integer(config.policy?.reserveMinimumBps, "policy.reserveMinimumBps", 0, 10_000);
  integer(config.policy?.rebalanceThresholdBps, "policy.rebalanceThresholdBps", 0, 10_000);
  bigintString(config.policy?.minimumActionAmount, "policy.minimumActionAmount");
  integer(config.policy?.maxMovementBpsPerCycle, "policy.maxMovementBpsPerCycle", 1, 10_000);
  integer(config.policy?.cooldownSeconds, "policy.cooldownSeconds", 0, 31_536_000);
  integer(config.policy?.maxPlanAgeBlocks, "policy.maxPlanAgeBlocks", 0, 1_000_000);
  integer(config.policy?.maxStateDriftBps, "policy.maxStateDriftBps", 0, 10_000);
  integer(config.policy?.maxObservationBlockSpan, "policy.maxObservationBlockSpan", 0, 1000);
  bigintString(config.policy?.minHealthFactor, "policy.minHealthFactor");
  integer(config.policy?.verificationToleranceBps, "policy.verificationToleranceBps", 0, 10_000);
  if (config.policy?.supplyOnly !== true) throw new Error("POC requires policy.supplyOnly=true");
  if (typeof config.policy.requireOracleFreshness !== "boolean") throw new Error("policy.requireOracleFreshness must be boolean");
  // Optional, backward compatible: absent maxTotalCapitalUnits means no cap is
  // enforced (pre-Fase 5 behavior). When present it must be a valid unsigned
  // integer string, same shape as the other base-asset amount fields.
  if (config.policy?.maxTotalCapitalUnits !== undefined) bigintString(config.policy.maxTotalCapitalUnits, "policy.maxTotalCapitalUnits");
  for (const protocol of config.protocols) {
    if (!protocol || typeof protocol.name !== "string" || !protocol.name.trim()) throw new Error("Protocol name is required");
    if (names.has(protocol.name)) throw new Error(`Duplicate protocol: ${protocol.name}`);
    names.add(protocol.name);
    if (typeof protocol.enabled !== "boolean") throw new Error(`Protocol ${protocol.name} enabled must be boolean`);
    integer(protocol.targetBps, `${protocol.name}.targetBps`, 0, 10_000);
    integer(protocol.maxBps, `${protocol.name}.maxBps`, 0, 10_000);
    if (protocol.targetBps > protocol.maxBps) throw new Error(`Protocol ${protocol.name} targetBps exceeds maxBps`);
    if (!protocol.enabled && protocol.targetBps !== 0) throw new Error(`Disabled protocol ${protocol.name} must have targetBps=0`);
    if (protocol.collateralTokenCode !== undefined && !/^[A-Za-z0-9_-]{1,32}$/.test(protocol.collateralTokenCode)) {
      throw new Error(`Protocol ${protocol.name} collateralTokenCode is invalid`);
    }
    if (protocol.loanTokenCode !== undefined && !/^[A-Za-z0-9_-]{1,32}$/.test(protocol.loanTokenCode)) {
      throw new Error(`Protocol ${protocol.name} loanTokenCode is invalid`);
    }
    if ((protocol.collateralTokenCode === undefined) !== (protocol.loanTokenCode === undefined)) {
      throw new Error(`Protocol ${protocol.name} must configure collateralTokenCode and loanTokenCode together`);
    }
    targetTotal += protocol.targetBps;
  }
  if (targetTotal !== 10_000) throw new Error(`reserveTargetBps plus protocol targets must equal 10000, received ${targetTotal}`);
  if (config.policy.reserveMinimumBps > config.policy.reserveTargetBps) throw new Error("reserveMinimumBps cannot exceed reserveTargetBps");
  if (!config.autonomous || typeof config.autonomous.enabled !== "boolean" || typeof config.autonomous.acknowledgement !== "string") throw new Error("autonomous policy is required");
  if (config.mode === "autonomous" && (!config.autonomous.enabled || config.autonomous.acknowledgement !== AUTONOMOUS_ACKNOWLEDGEMENT)) {
    throw new Error("Autonomous mode requires enabled=true and the exact acknowledgement");
  }
  config.execution ??= { kind: "disabled" };
  if (!(config.execution && ["disabled", "direct", "safe"].includes(config.execution.kind))) throw new Error("execution.kind must be disabled, direct or safe");
  if (config.execution.expectedSignerAddress !== undefined) {
    if (!isAddress(config.execution.expectedSignerAddress)) throw new Error("execution.expectedSignerAddress must be a valid address");
    config.execution.expectedSignerAddress = getAddress(config.execution.expectedSignerAddress);
  }
  if (config.execution.kind === "direct" && !config.execution.expectedSignerAddress) throw new Error("Direct execution requires execution.expectedSignerAddress");
  if (config.mode !== "observe" && config.execution.kind === "disabled") throw new Error(`${config.mode} mode requires direct or safe execution`);
  if (config.mode === "autonomous" && config.execution.kind !== "direct") throw new Error("Autonomous mode requires direct execution in the POC");
  if (config.execution.kind === "safe") {
    if (!config.safe || !isAddress(config.safe.address)) throw new Error("Safe execution requires safe.address");
    config.safe.address = getAddress(config.safe.address);
    if (!config.safe.txServiceUrl && !config.safe.apiKeyEnv) throw new Error("Safe execution requires safe.txServiceUrl or safe.apiKeyEnv");
    if (config.safe.txServiceUrl) {
      let parsed: URL;
      try { parsed = new URL(config.safe.txServiceUrl); } catch { throw new Error("safe.txServiceUrl must be a valid URL"); }
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("safe.txServiceUrl must use http or https");
      if ((parsed.hostname.endsWith("safe.global") || parsed.hostname.endsWith("5afe.dev")) && !config.safe.apiKeyEnv) {
        throw new Error("Official Safe Transaction Service URLs require safe.apiKeyEnv");
      }
    }
    if (config.safe.apiKeyEnv && !/^[A-Z][A-Z0-9_]{1,79}$/.test(config.safe.apiKeyEnv)) throw new Error("safe.apiKeyEnv must be an uppercase environment variable name");
  } else if (config.safe !== undefined) {
    throw new Error("safe configuration is allowed only when execution.kind=safe");
  }
  if (!config.runtime || typeof config.runtime.stateDirectory !== "string" || !config.runtime.stateDirectory.trim()) throw new Error("runtime.stateDirectory is required");
  integer(config.runtime.intervalSeconds, "runtime.intervalSeconds", 1, 86_400);
  integer(config.runtime.lockTtlSeconds, "runtime.lockTtlSeconds", 1, 86_400);
  integer(config.runtime.confirmations, "runtime.confirmations", 1, 100);
  integer(config.runtime.rpcRetries, "runtime.rpcRetries", 0, 20);
  integer(config.runtime.rpcRetryDelayMs, "runtime.rpcRetryDelayMs", 0, 60_000);
  if (config.runtime.simulationImpersonateAddress !== undefined) {
    if (!isAddress(config.runtime.simulationImpersonateAddress)) throw new Error("runtime.simulationImpersonateAddress must be a valid address");
    config.runtime.simulationImpersonateAddress = getAddress(config.runtime.simulationImpersonateAddress);
  }
  config.runtime.heartbeatPath ??= path.join(config.runtime.stateDirectory, "service-heartbeat.json");
  config.runtime.maxConsecutiveFailures ??= 5;
  if (typeof config.runtime.heartbeatPath !== "string" || !config.runtime.heartbeatPath.trim()) throw new Error("runtime.heartbeatPath is required");
  integer(config.runtime.maxConsecutiveFailures, "runtime.maxConsecutiveFailures", 1, 1000);
  return config;
}

export function loadAutomationConfig(filePath: string): AutomationConfig {
  const absolute = path.resolve(filePath);
  const config = validateAutomationConfig(JSON.parse(fs.readFileSync(absolute, "utf8")));
  // Relative paths are resolved against the config, not the caller's current directory.
  config.manifestPath = path.resolve(path.dirname(absolute), config.manifestPath);
  config.runtime.stateDirectory = path.resolve(path.dirname(absolute), config.runtime.stateDirectory);
  config.runtime.heartbeatPath = path.resolve(path.dirname(absolute), config.runtime.heartbeatPath);
  return config;
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}
