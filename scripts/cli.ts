/**
 * Single operational CLI for the active script suite.
 *
 * The command layer is intentionally thin: business logic lives in importable
 * operations under scripts/operations, so a website or autonomous service can
 * call exactly the same validated functions without spawning a shell process.
 * Mutations default to simulation and are sent only with --execute=true.
 * Use --encode-only=true to emit wallet/Safe compatible calldata.
 */
import hre from "hardhat";
import { getAddress } from "ethers";
import fs from "fs";
import { cliBoolean, cliString, parseCliArguments, stringifyForOutput } from "./framework/cli";
import { serializeError } from "./framework/errors";
import { loadManifest } from "./framework/manifest";
import { createRuntime } from "./framework/runtime";
import type { Address, OperationResult } from "./framework/types";
import { updateBeaconModule } from "./operations/administration/beacon";
import { configureCorePolicy } from "./operations/administration/core-policy";
import { setEmergencyState, setPluginCircuitBreaker } from "./operations/administration/emergency";
import { registerProtocol, setProtocolActive, setSelectorWhitelist, updateProtocol } from "./operations/administration/protocols";
import { configureAaveToken, configureEulerVault, configureMorphoMarket, configureMorphoVault, transferRegistryOwnership } from "./operations/administration/registries";
import { configureToken, removeToken } from "./operations/administration/tokens";
import { deployBundle, type SupportedBundle } from "./operations/deployment/deploy-bundle";
import { deployCore } from "./operations/deployment/deploy-core";
import { getPositionsByRisk, getProtocolHealth } from "./operations/monitoring/protocol-health";
import { getSystemStatus } from "./operations/monitoring/system-status";
import { executeProtocolAction, readProtocolPosition } from "./operations/protocols/positions";
import { depositToVault } from "./operations/vault/deposit";
import { swapVaultAssets } from "./operations/vault/swap";
import { withdrawFromVault } from "./operations/vault/withdraw";

function required(args: ReturnType<typeof parseCliArguments>, key: string): string {
  return cliString(args, key, true) as string;
}
function integer(args: ReturnType<typeof parseCliArguments>, key: string, fallback?: number): number {
  const raw = cliString(args, key, fallback === undefined);
  const value = raw === undefined ? fallback : Number(raw);
  if (value === undefined || !Number.isSafeInteger(value)) throw new Error(`--${key} must be an integer`);
  return value;
}
function bigintArg(args: ReturnType<typeof parseCliArguments>, key: string, requiredValue = true): bigint | undefined {
  const raw = cliString(args, key, requiredValue);
  return raw === undefined ? undefined : BigInt(raw);
}
function address(args: ReturnType<typeof parseCliArguments>, key: string): Address {
  return getAddress(required(args, key)) as Address;
}

async function run(): Promise<unknown> {
  const command = process.argv[2];
  if (!command || command.startsWith("--")) throw new Error("Missing command. See scripts/README.md");
  const args = parseCliArguments(process.argv.slice(3));
  const manifestPath = required(args, "manifest");
  const execute = cliBoolean(args, "execute", false);
  const encodeOnly = cliBoolean(args, "encode-only", false);

  if (command === "deploy-core") {
    return deployCore(hre, { manifestPath, manifest: fs.existsSync(manifestPath) ? loadManifest(manifestPath) : undefined,
      baseAssetCode: required(args, "base-code"), baseAssetAddress: address(args, "base-address"),
      baseAssetDecimals: integer(args, "base-decimals"), basePriceFeed: address(args, "base-price-feed"),
      basePriceFeedDecimals: integer(args, "feed-decimals"), basePriceHeartbeat: integer(args, "heartbeat"),
      quoteCurrency: cliString(args, "quote", false), execute, confirmations: integer(args, "confirmations", 1) });
  }
  if (command === "deploy-bundle") {
    const manifest = loadManifest(manifestPath);
    const rawKind = required(args, "kind");
    const addresses: Record<string, Address> = {};
    for (const key of ["router", "quoterV2", "pool", "evc", "accountLens", "vaultLens", "utilsLens", "morpho"]) {
      const value = cliString(args, key, false);
      if (value) addresses[key] = getAddress(value) as Address;
    }
    return deployBundle(hre, { kind: rawKind as SupportedBundle | "dolomite" | "gmx", manifest, manifestPath, execute,
      confirmations: integer(args, "confirmations", 1), addresses });
  }

  const manifest = loadManifest(manifestPath);
  const caller = cliString(args, "caller", false);
  const readOnly = new Set(["status", "health", "positions", "position"]).has(command);
  const runtime = await createRuntime(hre, {
    manifest,
    signerAddress: caller,
    requireSigner: !readOnly && !encodeOnly,
    // Safe default: even with --execute=true the caller must explicitly opt out
    // of simulation using --dry-run=false before state can persist.
    options: { execute, encodeOnly, dryRun: cliBoolean(args, "dry-run", true), confirmations: integer(args, "confirmations", 1),
      rpcRetries: integer(args, "rpc-retries", 3), rpcRetryDelayMs: integer(args, "rpc-retry-delay-ms", 250) },
  });

  switch (command) {
    case "status": return getSystemStatus(runtime);
    case "health": return getProtocolHealth(runtime);
    case "positions": return getPositionsByRisk(runtime);
    case "position": return readProtocolPosition(runtime, required(args, "protocol"), required(args, "token"));
    case "deposit": return depositToVault(runtime, { amount: bigintArg(args, "amount") as bigint, wrapNative: cliBoolean(args, "wrap-native"), caller });
    case "withdraw": return withdrawFromVault(runtime, { shares: bigintArg(args, "shares", false), percentageBps: integer(args, "percentage-bps", 10_000), deadlineSeconds: integer(args, "deadline-seconds", 1_200), caller });
    case "swap": return swapVaultAssets(runtime, { tokenIn: required(args, "token-in"), tokenOut: required(args, "token-out"), amountIn: bigintArg(args, "amount") as bigint, maxSlippageBps: integer(args, "slippage-bps"), deadlineSeconds: integer(args, "deadline-seconds", 1_200) });
    case "protocol-action": return executeProtocolAction(runtime, { operation: required(args, "operation") as "deposit" | "withdraw" | "borrow" | "repay" | "close", protocolName: required(args, "protocol"), tokenCode: cliString(args, "token", false), amount: bigintArg(args, "amount", false), debtTokenCode: cliString(args, "debt-token", false), collateralTokenCode: cliString(args, "collateral-token", false) });
    case "update-beacon": return updateBeaconModule(runtime, required(args, "module"), address(args, "implementation"));
    case "core-policy": return configureCorePolicy(runtime, { feeRecipient: address(args, "fee-recipient"), depositFeeBps: integer(args, "deposit-fee-bps"), withdrawFeeBps: integer(args, "withdraw-fee-bps"),
      depositsEnabled: cliBoolean(args, "deposits-enabled"), withdrawsEnabled: cliBoolean(args, "withdraws-enabled"), swapsEnabled: cliBoolean(args, "swaps-enabled"),
      hourlyWithdrawLimit: bigintArg(args, "hourly-withdraw-limit") as bigint, dailyWithdrawLimit: bigintArg(args, "daily-withdraw-limit") as bigint,
      minWithdraw: bigintArg(args, "min-withdraw") as bigint, maxWithdraw: bigintArg(args, "max-withdraw") as bigint,
      swapTokenCode: required(args, "swap-token"), minSwapAmount: bigintArg(args, "min-swap") as bigint, maxSwapAmount: bigintArg(args, "max-swap") as bigint, maxSlippageBps: integer(args, "max-slippage-bps"),
      depositRatePerUser: bigintArg(args, "deposit-rate-user") as bigint, depositRateGlobal: bigintArg(args, "deposit-rate-global") as bigint,
      withdrawRatePerUser: bigintArg(args, "withdraw-rate-user") as bigint, withdrawRateGlobal: bigintArg(args, "withdraw-rate-global") as bigint });
    case "protocol-register": case "protocol-update": {
      const input = { name: required(args, "protocol"), plugin: address(args, "plugin"), lensAdapter: address(args, "lens"), registry: cliString(args, "registry", false) };
      return command === "protocol-register" ? registerProtocol(runtime, input) : updateProtocol(runtime, input);
    }
    case "protocol-status": return setProtocolActive(runtime, required(args, "protocol"), cliBoolean(args, "active"));
    case "protocol-selectors": return setSelectorWhitelist(runtime, required(args, "protocol"), required(args, "signatures").split(",").map(item => item.trim()), cliBoolean(args, "allowed", true));
    case "token-config": return configureToken(runtime, { code: required(args, "token"), address: address(args, "address"), decimals: integer(args, "decimals"), heartbeat: bigintArg(args, "heartbeat") as bigint });
    case "token-remove": return removeToken(runtime, required(args, "token"));
    case "registry-aave": return configureAaveToken(runtime, required(args, "token"), address(args, "underlying"), address(args, "a-token"), address(args, "debt-token"));
    case "registry-euler": return configureEulerVault(runtime, required(args, "token"), address(args, "vault"));
    case "registry-morpho-market": return configureMorphoMarket(runtime, { collateralCode: required(args, "collateral"), loanCode: required(args, "loan"), collateralToken: address(args, "collateral-token"), loanToken: address(args, "loan-token"), oracle: address(args, "oracle"), irm: address(args, "irm"), lltv: bigintArg(args, "lltv") as bigint });
    case "registry-morpho-vault": return configureMorphoVault(runtime, required(args, "token"), address(args, "vault"), cliBoolean(args, "default"));
    case "registry-transfer-ownership": return transferRegistryOwnership(runtime, required(args, "registry"), address(args, "new-owner"));
    case "emergency": return setEmergencyState(runtime, cliBoolean(args, "active"), cliString(args, "reason", false));
    case "circuit-breaker": return setPluginCircuitBreaker(runtime, required(args, "plugin"), cliBoolean(args, "active"));
    default: throw new Error(`Unknown command: ${command}`);
  }
}

run().then(result => {
  process.stdout.write(`${stringifyForOutput(result)}\n`);
}).catch(error => {
  const result: OperationResult<never> = { success: false, operation: process.argv[2] ?? "unknown", transactions: [], error: serializeError(error) };
  process.stderr.write(`${stringifyForOutput(result)}\n`);
  process.exitCode = 1;
});
