import { expect } from "chai";
import fs from "fs";
import path from "path";
import { ethers } from "hardhat";
import { hashValue, validateAutomationConfig } from "../../scripts/automation/config";
import { MemoryEventSink } from "../../scripts/automation/alerts";
import { observationsMateriallyDiffer, VaultAutomationController } from "../../scripts/automation/controller";
import { observationFingerprint, observeVault } from "../../scripts/automation/observer";
import { buildRebalancePlan } from "../../scripts/automation/planner";
import { runAutomationPreflight } from "../../scripts/automation/preflight";
import { evaluateRisk } from "../../scripts/automation/risk";
import { evaluateStrategy } from "../../scripts/automation/strategy";
import { OfficialSafeAdapter, planToSafeTransactions, type SafeAdapterDependencies } from "../../scripts/automation/safe";
import { readServiceHeartbeat, runAutomationService } from "../../scripts/automation/service";
import { assertTransition, JsonAutomationStore } from "../../scripts/automation/store";
import type { AutomationConfig, AutomationRun, SafeProposalBinding, StrategyDecision, VaultObservation } from "../../scripts/automation/types";
import { verifyRebalance } from "../../scripts/automation/verifier";
import { emptyManifest, setContract } from "../../scripts/framework/manifest";
import type { Address, ScriptRuntime } from "../../scripts/framework/types";
import { executePlan } from "../../scripts/framework/transactions";
import { registerProtocol } from "../../scripts/operations/administration/protocols";
import { getProtocolHealth } from "../../scripts/operations/monitoring/protocol-health";
import { deployScriptTestFixture } from "../integration/scripts/fixtures";

function config(overrides: Partial<AutomationConfig> = {}): AutomationConfig {
  return validateAutomationConfig({
    schemaVersion: 1, vaultId: "test-vault", chainId: 42161, manifestPath: "manifest.json", mode: "advisory",
    baseAssetCode: "WETH", baseAssetDecimals: 18,
    protocols: [{ name: "A", enabled: true, targetBps: 4000, maxBps: 6000 }, { name: "B", enabled: true, targetBps: 4000, maxBps: 6000 }],
    policy: { reserveTargetBps: 2000, reserveMinimumBps: 1000, rebalanceThresholdBps: 100, minimumActionAmount: "1",
      maxMovementBpsPerCycle: 5000, cooldownSeconds: 0, maxPlanAgeBlocks: 10, maxStateDriftBps: 5, maxObservationBlockSpan: 3,
      minHealthFactor: ethers.parseEther("1.5").toString(), requireOracleFreshness: false, supplyOnly: true, verificationToleranceBps: 100 },
    autonomous: { enabled: false, acknowledgement: "" },
    execution: { kind: "direct", expectedSignerAddress: ethers.ZeroAddress },
    runtime: { stateDirectory: ".automation-test", intervalSeconds: 10, lockTtlSeconds: 60, confirmations: 1, rpcRetries: 1, rpcRetryDelayMs: 1 },
    ...overrides,
  });
}

function observation(): VaultObservation {
  const base: Omit<VaultObservation, "fingerprint"> = {
    vaultId: "test-vault", chainId: 42161, blockNumberStart: 100, blockNumberEnd: 100, observedAt: "2026-01-01T00:00:00.000Z",
    baseAssetCode: "WETH", custodyBalance: "200", managedAssets: "1000", reserveBps: 2000, paused: false,
    depositsEnabled: true, withdrawsEnabled: true, globalHealthFactor: ethers.MaxUint256.toString(), oracleDataAvailable: false,
    protocols: [
      { name: "A", active: true, balance: "700", debt: "0", healthFactor: ethers.MaxUint256.toString(), circuitBreakerActive: false, allocationBps: 7000 },
      { name: "B", active: true, balance: "100", debt: "0", healthFactor: ethers.MaxUint256.toString(), circuitBreakerActive: false, allocationBps: 1000 },
    ],
  };
  return { ...base, fingerprint: observationFingerprint(base) };
}

describe("Vault Automation Controller", function () {
  this.timeout(180_000);

  it("validates allocation policy and keeps autonomy fail-closed", function () {
    expect(() => config({ mode: "autonomous" })).to.throw("acknowledgement");
    expect(() => validateAutomationConfig({ ...config(), policy: { ...config().policy, reserveTargetBps: 1999 } })).to.throw("equal 10000");
    expect(() => validateAutomationConfig({ ...config(), protocols: [
      ...config().protocols,
      { name: "Morpho", enabled: false, targetBps: 0, maxBps: 0, collateralTokenCode: "WETH" },
    ] })).to.throw("collateralTokenCode and loanTokenCode together");
    expect(config().policy.supplyOnly).to.equal(true);
  });

  it("keeps execution identity and secrets fail-closed", function () {
    expect(() => validateAutomationConfig({ ...config(), execution: { kind: "direct" } })).to.throw("expectedSignerAddress");
    expect(() => validateAutomationConfig({ ...config(), privateKey: "0xsecret" })).to.throw("forbidden");
    expect(() => validateAutomationConfig({ ...config(), execution: { kind: "safe" }, safe: { address: ethers.ZeroAddress, txServiceUrl: "ftp://invalid" } })).to.throw("http or https");
    expect(() => validateAutomationConfig({ ...config(), mode: "autonomous", autonomous: { enabled: true, acknowledgement: "I_ACCEPT_LIMITED_AUTONOMOUS_EXECUTION" }, execution: { kind: "safe" }, safe: { address: ethers.ZeroAddress, txServiceUrl: "http://localhost" } })).to.throw("requires direct");
  });

  it("builds deterministic withdraw-first deltas and applies movement caps", function () {
    const decision = evaluateStrategy(config(), observation());
    expect(decision.kind).to.equal("REBALANCE");
    expect(decision.actions.map(item => `${item.kind}:${item.protocolName}:${item.amount}`)).to.deep.equal(["withdraw:A:300", "deposit:B:300"]);
    const capped = evaluateStrategy(config({ policy: { ...config().policy, maxMovementBpsPerCycle: 1000 } }), observation());
    expect(capped.actions.map(item => item.amount)).to.deep.equal(["100", "100"]);
    const cooldown = evaluateStrategy(config({ policy: { ...config().policy, cooldownSeconds: 3600 } }), observation(), { lastCompletedAt: new Date().toISOString() });
    expect(cooldown.kind).to.equal("NO_ACTION");
    const belowMinimumAfterCap = evaluateStrategy(config({ policy: { ...config().policy, minimumActionAmount: "150", maxMovementBpsPerCycle: 1000 } }), observation());
    expect(belowMinimumAfterCap.kind).to.equal("NO_ACTION");
    const balanced = observation();
    balanced.custodyBalance = "200"; balanced.protocols[0].balance = "400"; balanced.protocols[0].allocationBps = 4000;
    balanced.protocols[1].balance = "400"; balanced.protocols[1].allocationBps = 4000;
    expect(evaluateStrategy(config(), balanced).kind).to.equal("NO_ACTION");
  });

  it("rejects debt, unknown circuit state, caps, reserve and missing required oracle data", function () {
    const current = observation();
    current.protocols[0].debt = "1"; current.protocols[0].circuitBreakerActive = undefined;
    const strict = config({ policy: { ...config().policy, requireOracleFreshness: true, reserveMinimumBps: 1500 } });
    const decision = evaluateStrategy(strict, current);
    const deposit = decision.actions.find(item => item.kind === "deposit");
    if (deposit) deposit.amount = "400"; // Projected reserve becomes 100/1000 = 1000 bps.
    const report = evaluateRisk(strict, current, decision);
    const codes = report.findings.filter(item => item.severity === "blocking").map(item => item.code);
    expect(codes).to.include.members(["DEBT_FORBIDDEN", "CIRCUIT_STATUS_UNKNOWN", "ORACLE_DATA_UNAVAILABLE", "RESERVE_BELOW_MINIMUM"]);
  });

  it("enforces every operational risk guard independently of strategy scoring", function () {
    const cases: Array<{ code: string; mutate: (c: AutomationConfig, o: VaultObservation, d: ReturnType<typeof evaluateStrategy>) => void }> = [
      { code: "VAULT_PAUSED", mutate: (_c, o) => { o.paused = true; } },
      { code: "DEPOSITS_DISABLED", mutate: (_c, o) => { o.depositsEnabled = false; } },
      { code: "WITHDRAWS_DISABLED", mutate: (_c, o) => { o.withdrawsEnabled = false; } },
      { code: "PROTOCOL_INACTIVE", mutate: (_c, o) => { o.protocols[0].active = false; } },
      { code: "CIRCUIT_BREAKER", mutate: (_c, o) => { o.protocols[0].circuitBreakerActive = true; } },
      { code: "HEALTH_BELOW_MINIMUM", mutate: (_c, o) => { o.protocols[0].healthFactor = ethers.parseEther("1.1").toString(); } },
      { code: "PROTOCOL_CAP_EXCEEDED", mutate: (_c, _o, d) => { const w = d.actions.find(item => item.kind === "withdraw"); if (w) w.amount = "0"; } },
      { code: "MOVEMENT_LIMIT", mutate: (_c, _o, d) => { for (const action of d.actions) action.amount = "600"; } },
      { code: "AUTONOMY_NOT_ACKNOWLEDGED", mutate: (c) => { c.mode = "autonomous"; c.autonomous.enabled = false; } },
    ];
    for (const testCase of cases) {
      const currentConfig = config(); const currentObservation = observation(); const decision = evaluateStrategy(currentConfig, currentObservation);
      testCase.mutate(currentConfig, currentObservation, decision);
      expect(evaluateRisk(currentConfig, currentObservation, decision).findings.map(item => item.code), testCase.code).to.include(testCase.code);
    }
  });

  it("fingerprints only deterministic economic state", function () {
    const first = observation(); const second = { ...first, observedAt: "2030-01-01T00:00:00.000Z", blockNumberStart: 200, blockNumberEnd: 200 };
    const { fingerprint: _one, ...firstData } = first; const { fingerprint: _two, ...secondData } = second;
    expect(observationFingerprint(firstData)).to.equal(observationFingerprint(secondData));
    secondData.custodyBalance = "201";
    expect(observationFingerprint(firstData)).to.not.equal(observationFingerprint(secondData));
  });

  it("allows bounded passive yield drift but rejects material state changes", function () {
    const before = observation(); const tinyYield = observation(); tinyYield.protocols[0].balance = "701"; tinyYield.managedAssets = "1001";
    expect(observationsMateriallyDiffer(before, tinyYield, 20)).to.equal(false);
    const material = observation(); material.custodyBalance = "250"; material.managedAssets = "1050";
    expect(observationsMateriallyDiffer(before, material, 20)).to.equal(true);
    const structural = observation(); structural.protocols[0].circuitBreakerActive = true;
    expect(observationsMateriallyDiffer(before, structural, 10_000)).to.equal(true);
  });

  it("creates dependency-checked portable plans and verifies movement direction", async function () {
    const [signer] = await ethers.getSigners();
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "WETH", baseAssetAddress: ethers.ZeroAddress, baseAssetDecimals: 18 });
    setContract(manifest, "protocolManager", signer.address);
    const runtime = { provider: ethers.provider, signer, signerAddress: signer.address as Address, chainId: 42161, networkName: "hardhat", manifest,
      options: { execute: false, dryRun: true, encodeOnly: true, confirmations: 1, allowedChainIds: [42161] } } satisfies ScriptRuntime;
    const decision = evaluateStrategy(config(), observation());
    const plan = buildRebalancePlan(runtime, decision);
    expect(plan.calls.map(item => item.id)).to.deep.equal(["1-withdraw-A", "2-deposit-B"]);
    expect(plan.calls[1].dependsOn).to.deep.equal(["1-withdraw-A"]);
    expect(planToSafeTransactions(plan).map(item => ({ to: item.to, value: item.value, data: item.data, operation: item.operation })))
      .to.deep.equal(plan.calls.map(item => ({ to: item.target, value: item.value, data: item.data, operation: 0 })));
    const after = observation(); after.protocols[0].balance = "400"; after.protocols[1].balance = "400";
    expect(verifyRebalance(config(), observation(), after, decision).passed).to.equal(true);
    const lossy = { ...after, managedAssets: "800", custodyBalance: "0" };
    expect(verifyRebalance(config(), observation(), lossy, decision).findings.map(item => item.code)).to.include("POST_MANAGED_ASSET_LOSS");
  });

  it("uses the official Safe adapter boundary to estimate, bind and read one exact batch", async function () {
    const [signer] = await ethers.getSigners();
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "WETH", baseAssetAddress: ethers.ZeroAddress, baseAssetDecimals: 18 });
    setContract(manifest, "protocolManager", signer.address);
    const runtime = { provider: ethers.provider, signer, signerAddress: signer.address as Address, chainId: 42161, networkName: "hardhat", manifest,
      options: { execute: false, dryRun: true, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] } } satisfies ScriptRuntime;
    const safeConfig = config({ execution: { kind: "safe" }, safe: { address: signer.address, txServiceUrl: "http://localhost:8000" } });
    const plan = buildRebalancePlan(runtime, evaluateStrategy(safeConfig, observation()));
    const now = new Date().toISOString();
    const run = { schemaVersion: 1, id: "adapter-run", vaultId: safeConfig.vaultId, chainId: safeConfig.chainId, configHash: hashValue(safeConfig), mode: safeConfig.mode,
      state: "AWAITING_SAFE_PROPOSAL", createdAt: now, updatedAt: now, transitions: [{ to: "AWAITING_SAFE_PROPOSAL", at: now }], events: [], plan } as AutomationRun;
    const created: Array<{ transactions: unknown[]; onlyCalls?: boolean; options?: { safeTxGas?: string } }> = [];
    let proposed: Record<string, unknown> | undefined;
    const safeTxHash = `0x${"ab".repeat(32)}`;
    const transactionData = (safeTxGas: string) => ({ to: signer.address, value: "0", data: "0x1234", operation: 0, safeTxGas, baseGas: "0", gasPrice: "0",
      gasToken: ethers.ZeroAddress, refundReceiver: ethers.ZeroAddress, nonce: 7 });
    const dependencies: SafeAdapterDependencies = {
      createProtocolClient: async () => ({
        isOwner: async () => true,
        createTransaction: async input => {
          created.push(input as never); const data = transactionData(input.options?.safeTxGas ?? "0");
          return { data, signatures: new Map(), getSignature: () => undefined, addSignature: () => undefined, encodedSignatures: () => "0x" } as never;
        },
        getTransactionHash: async () => safeTxHash,
        signHash: async () => ({ signer: signer.address, data: "0xsignature", isContractSignature: false, staticPart: () => "0x", dynamicPart: () => "0x" }),
      }),
      createServiceClient: () => ({
        estimateSafeTransaction: async () => ({ safeTxGas: "12345" }),
        proposeTransaction: async input => { proposed = input as unknown as Record<string, unknown>; },
        getTransaction: async () => ({ safe: signer.address, to: signer.address, value: "0", data: "0x1234", operation: 0, gasToken: ethers.ZeroAddress,
          safeTxGas: "12345", baseGas: "0", gasPrice: "0", refundReceiver: ethers.ZeroAddress, nonce: "7", executionDate: null,
          submissionDate: now, modified: now, blockNumber: null, transactionHash: null, safeTxHash, executor: null, proposer: signer.address,
          proposedByDelegate: null, isExecuted: false, isSuccessful: null, ethGasPrice: null, maxFeePerGas: null, maxPriorityFeePerGas: null,
          gasUsed: null, fee: null, origin: "", confirmationsRequired: 2, trusted: true, signatures: null }),
      }),
    };
    const adapter = new OfficialSafeAdapter(dependencies);
    const prepared = await adapter.prepareAndPropose(runtime, safeConfig, run, {});
    expect(created).to.have.length(2); expect(created.every(item => item.onlyCalls)).to.equal(true); expect(created[1].options?.safeTxGas).to.equal("12345");
    expect(prepared.binding.safeTxHash).to.equal(safeTxHash); expect(prepared.binding.transactionData.safeTxGas).to.equal("12345");
    expect(proposed?.safeTxHash).to.equal(safeTxHash);
    const status = await adapter.getExecutionStatus(safeConfig, prepared.binding, {});
    expect(status.executed).to.equal(false); expect(status.transactionData).to.deep.equal(prepared.binding.transactionData);
  });

  it("writes service heartbeats and forwards the persistent gate without hiding failures", async function () {
    const directory = path.join(process.cwd(), ".automation-test-state", `service-${Date.now()}`);
    const heartbeatPath = path.join(directory, "heartbeat.json");
    const serviceConfig = config({ runtime: { ...config().runtime, stateDirectory: directory, heartbeatPath, intervalSeconds: 1, maxConsecutiveFailures: 2 } });
    const abort = new AbortController();
    const seen: boolean[] = [];
    const now = new Date().toISOString();
    const fakeController = {
      runCycle: async (options: { allowPersistentExecution?: boolean }) => {
        seen.push(Boolean(options.allowPersistentExecution)); abort.abort();
        return { schemaVersion: 1, id: "service-run", vaultId: serviceConfig.vaultId, chainId: serviceConfig.chainId, configHash: "hash", mode: serviceConfig.mode,
          state: "NO_ACTION", createdAt: now, updatedAt: now, transitions: [{ to: "NO_ACTION", at: now }], events: [] } as AutomationRun;
      },
    };
    try {
      await runAutomationService(fakeController as never, serviceConfig, { allowPersistentExecution: true, signal: abort.signal });
      expect(seen).to.deep.equal([true]);
      const heartbeat = readServiceHeartbeat(heartbeatPath);
      expect(heartbeat.state).to.equal("stopped"); expect(heartbeat.lastRunId).to.equal("service-run"); expect(heartbeat.consecutiveFailures).to.equal(0);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it("stops the supervised service after the configured failure threshold", async function () {
    const directory = path.join(process.cwd(), ".automation-test-state", `service-failure-${Date.now()}`);
    const heartbeatPath = path.join(directory, "heartbeat.json");
    const serviceConfig = config({ runtime: { ...config().runtime, stateDirectory: directory, heartbeatPath, intervalSeconds: 1, maxConsecutiveFailures: 1 } });
    const now = new Date().toISOString();
    const fakeController = { runCycle: async () => ({ schemaVersion: 1, id: "failed-run", vaultId: serviceConfig.vaultId, chainId: serviceConfig.chainId,
      configHash: "hash", mode: serviceConfig.mode, state: "FAILED", createdAt: now, updatedAt: now, transitions: [{ to: "FAILED", at: now }], events: [] } as AutomationRun) };
    try {
      await expect(runAutomationService(fakeController as never, serviceConfig, { allowPersistentExecution: false })).to.be.rejectedWith("consecutive failed runs");
      expect(readServiceHeartbeat(heartbeatPath).state).to.equal("failed");
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it("persists atomic state, enforces transitions and excludes a second worker", function () {
    const directory = path.join(process.cwd(), ".automation-test-state", `store-${Date.now()}`);
    const store = new JsonAutomationStore(directory);
    const now = new Date().toISOString();
    const run: AutomationRun = { schemaVersion: 1, id: "run-1", vaultId: "test-vault", chainId: 42161, configHash: "hash", mode: "advisory",
      state: "CREATED", createdAt: now, updatedAt: now, transitions: [{ to: "CREATED", at: now }], events: [] };
    try {
      store.create(run); store.transition(run.id, "OBSERVED");
      expect(store.get(run.id).state).to.equal("OBSERVED");
      expect(() => assertTransition("OBSERVED", "COMPLETED")).to.throw("Invalid automation transition");
      const lock = store.acquireLock("test-vault", 60);
      expect(() => store.acquireLock("test-vault", 60)).to.throw("already locked");
      lock.release();
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it("observes, simulates atomically, approves, executes and verifies a two-protocol rebalance", async function () {
    const fixture = await deployScriptTestFixture();
    const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
    const manager = await ProtocolManager.deploy(await fixture.beacon.getAddress());
    await fixture.beacon.updateImplementation("ProtocolManager", await manager.getAddress());
    await fixture.proxyGeneral.authorizeModule(await manager.getAddress(), "ProtocolManager");
    const mockA = await (await ethers.getContractFactory("MockOperationalProtocol")).deploy(await fixture.proxyGeneral.getAddress(), await fixture.mockWETH.getAddress());
    const mockB = await (await ethers.getContractFactory("MockOperationalProtocol")).deploy(await fixture.proxyGeneral.getAddress(), await fixture.mockWETH.getAddress());
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "WETH", baseAssetAddress: await fixture.mockWETH.getAddress(), baseAssetDecimals: 18, deployer: fixture.owner.address });
    for (const [name, contract] of Object.entries({ beacon: fixture.beacon, proxyGeneral: fixture.proxyGeneral, liquidityManager: fixture.liquidityManager,
      protocolManager: manager, valueCalculator: fixture.valueCalculator })) setContract(manifest, name, await contract.getAddress());
    const runtime: ScriptRuntime = { provider: ethers.provider, signer: fixture.owner, signerAddress: fixture.owner.address as Address, chainId: 42161,
      networkName: "hardhat", manifest, options: { execute: true, dryRun: false, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] } };
    for (const [name, plugin] of [["A", mockA], ["B", mockB]] as const) {
      expect((await registerProtocol(runtime, { name, plugin: await plugin.getAddress(), lensAdapter: await plugin.getAddress() })).success).to.equal(true);
      manifest.protocols[name] = { plugin: await plugin.getAddress() as Address, lensAdapter: await plugin.getAddress() as Address, active: true, kind: "aave" };
    }
    const hidden = await (await ethers.getContractFactory("MockOperationalProtocol")).deploy(await fixture.proxyGeneral.getAddress(), await fixture.mockWETH.getAddress());
    expect((await registerProtocol(runtime, { name: "Hidden", plugin: await hidden.getAddress(), lensAdapter: await hidden.getAddress() })).success).to.equal(true);
    const custody = await fixture.mockWETH.balanceOf(await fixture.proxyGeneral.getAddress());
    await manager.deposit("A", "WETH", custody * 8n / 10n);
    const directory = path.join(process.cwd(), ".automation-test-state", `integration-${Date.now()}`);
    const automationConfig = config({
      execution: { kind: "direct", expectedSignerAddress: fixture.owner.address },
      runtime: { ...config().runtime, stateDirectory: directory, heartbeatPath: path.join(directory, "heartbeat.json") },
    });
    const store = new JsonAutomationStore(directory); const sink = new MemoryEventSink();
    const controller = new VaultAutomationController(runtime, automationConfig, store, sink);
    try {
      const preflight = await runAutomationPreflight(runtime, automationConfig);
      expect(preflight.ready, preflight.checks.filter(item => item.status === "FAIL").map(item => item.message).join("; ")).to.equal(true);
      const [, other] = await ethers.getSigners();
      const wrongIdentity = config({ execution: { kind: "direct", expectedSignerAddress: other.address }, runtime: automationConfig.runtime });
      const failedPreflight = await runAutomationPreflight(runtime, wrongIdentity);
      expect(failedPreflight.ready).to.equal(false);
      expect(failedPreflight.checks.filter(item => item.status === "FAIL").map(item => item.id)).to.include.members(["DIRECT_SIGNER_MATCH", "DIRECT_OWNER_MATCH"]);
      const health = await getProtocolHealth(runtime);
      expect(health.summaries).to.have.length(3, "summary ABI must match the Solidity struct for registered protocols");
      await expect(observeVault(runtime, automationConfig)).to.be.rejectedWith("Active protocol Hidden is missing");
      await manager.setProtocolActive("Hidden", false);
      const before = await observeVault(runtime, automationConfig);
      const simulated = await controller.runCycle();
      expect(simulated.state).to.equal("AWAITING_APPROVAL");
      expect(simulated.plan?.calls).to.have.length(2);
      expect((await observeVault(runtime, automationConfig)).fingerprint).to.equal(before.fingerprint, "dry-run must revert the complete sequence");
      controller.approve(simulated.id, fixture.owner.address);
      const completed = await controller.executeApproved(simulated.id, true);
      expect(completed.state).to.equal("COMPLETED");
      expect(completed.verification?.passed).to.equal(true);
      expect(sink.events.map(item => item.type)).to.include.members(["AWAITING_APPROVAL", "CYCLE_COMPLETED"]);

      // Exercise the external Safe reconciliation path with a real confirmed
      // protocol call. The Safe service itself is replaced by an immutable
      // binding/status object; receipt and post-state are real Hardhat data.
      const safeBefore = await observeVault(runtime, automationConfig);
      const safeAmount = BigInt(safeBefore.protocols[0].balance) / 10n;
      const safeDecision: StrategyDecision = { kind: "REBALANCE", reason: "safe reconciliation test", actions: [{ id: "safe-withdraw", kind: "withdraw", protocolName: "A", tokenCode: "WETH", amount: safeAmount.toString(), reason: "test" }],
        maximumDriftBps: 0, proposedMovement: safeAmount.toString(), targetAmounts: {} };
      const safeConfig = config({ execution: { kind: "safe" }, safe: { address: await manager.getAddress(), txServiceUrl: "http://localhost:8000" },
        runtime: automationConfig.runtime });
      const safePlan = buildRebalancePlan(runtime, safeDecision);
      const safeNow = new Date().toISOString();
      const safeRun: AutomationRun = { schemaVersion: 1, id: "safe-success-run", vaultId: safeConfig.vaultId, chainId: safeConfig.chainId, configHash: hashValue(safeConfig), mode: safeConfig.mode,
        state: "AWAITING_SAFE_PROPOSAL", createdAt: safeNow, updatedAt: safeNow, transitions: [{ to: "AWAITING_SAFE_PROPOSAL", at: safeNow }], events: [], observation: safeBefore, decision: safeDecision, plan: safePlan };
      store.create(safeRun);
      const safeController = new VaultAutomationController(runtime, safeConfig, store, sink);
      const safeBinding: SafeProposalBinding = { safeAddress: await manager.getAddress(), safeTxHash: `0x${"33".repeat(32)}`, nonce: 3, proposer: fixture.owner.address, proposedAt: safeNow,
        transactionData: { to: await manager.getAddress(), value: "0", data: safePlan.calls[0].data, operation: 0, safeTxGas: "1", baseGas: "0", gasPrice: "0", gasToken: ethers.ZeroAddress, refundReceiver: ethers.ZeroAddress, nonce: 3 } };
      expect((await safeController.bindSafeProposal(safeRun.id, safeBinding, true)).state).to.equal("AWAITING_APPROVAL");
      const externalExecution = await executePlan(runtime, safePlan);
      expect(externalExecution.success).to.equal(true);
      const externalHash = externalExecution.transactions[0].transactionHash as string;
      const safeCompleted = await safeController.reconcileSafeExecution(safeRun.id, { safeAddress: safeBinding.safeAddress, safeTxHash: safeBinding.safeTxHash,
        transactionData: safeBinding.transactionData, executed: true, trusted: true, successful: true, transactionHash: externalHash });
      expect(safeCompleted.state).to.equal("COMPLETED");

      // A plan approved against one fingerprint must never execute after an
      // unrelated balance change, even if its block-age limit is still valid.
      await fixture.mockWETH.deposit({ value: ethers.parseEther("1") });
      await fixture.mockWETH.transfer(await fixture.proxyGeneral.getAddress(), ethers.parseEther("1"));
      const staleCandidate = await controller.runCycle();
      expect(staleCandidate.state).to.equal("AWAITING_APPROVAL");
      controller.approve(staleCandidate.id, fixture.owner.address);
      await fixture.mockWETH.deposit({ value: ethers.parseEther("0.01") });
      await fixture.mockWETH.transfer(await fixture.proxyGeneral.getAddress(), ethers.parseEther("0.01"));
      expect((await controller.executeApproved(staleCandidate.id, true)).state).to.equal("STALE");
      await expect(controller.executeApproved("missing-run", true)).to.be.rejectedWith("does not exist");
      const releasedAfterReadFailure = store.acquireLock(automationConfig.vaultId, 60);
      releasedAfterReadFailure.release();
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it("binds one exact Safe proposal and never treats a pending service response as execution", async function () {
    const [signer] = await ethers.getSigners();
    const manager = await (await ethers.getContractFactory("MockOperationalProtocol")).deploy(signer.address, ethers.ZeroAddress);
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "WETH", baseAssetAddress: ethers.ZeroAddress, baseAssetDecimals: 18 });
    setContract(manifest, "protocolManager", await manager.getAddress());
    const runtime = { provider: ethers.provider, signer, signerAddress: signer.address as Address, chainId: 42161, networkName: "hardhat", manifest,
      options: { execute: false, dryRun: true, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] } } satisfies ScriptRuntime;
    const directory = path.join(process.cwd(), ".automation-test-state", `safe-${Date.now()}`);
    const safeConfig = config({ execution: { kind: "safe" }, safe: { address: await manager.getAddress(), txServiceUrl: "http://localhost:8000" },
      runtime: { ...config().runtime, stateDirectory: directory, heartbeatPath: path.join(directory, "heartbeat.json") } });
    const current = observation(); current.managedAssets = ethers.MaxUint256.toString();
    const decision = evaluateStrategy(safeConfig, current); const plan = buildRebalancePlan(runtime, decision);
    const now = new Date().toISOString();
    const run: AutomationRun = { schemaVersion: 1, id: "safe-run", vaultId: safeConfig.vaultId, chainId: safeConfig.chainId, configHash: hashValue(safeConfig), mode: safeConfig.mode,
      state: "AWAITING_SAFE_PROPOSAL", createdAt: now, updatedAt: now, transitions: [{ to: "AWAITING_SAFE_PROPOSAL", at: now }], events: [], observation: current, decision, plan };
    const store = new JsonAutomationStore(directory); store.create(run);
    const controller = new VaultAutomationController(runtime, safeConfig, store, new MemoryEventSink());
    const binding: SafeProposalBinding = { safeAddress: await manager.getAddress(), safeTxHash: `0x${"11".repeat(32)}`, nonce: 1, proposer: signer.address, proposedAt: now,
      transactionData: { to: await manager.getAddress(), value: "0", data: "0x1234", operation: 0, safeTxGas: "0", baseGas: "0", gasPrice: "0", gasToken: ethers.ZeroAddress, refundReceiver: ethers.ZeroAddress, nonce: 1 } };
    try {
      expect((await controller.bindSafeProposal(run.id, binding, true)).state).to.equal("AWAITING_APPROVAL");
      const pending = await controller.reconcileSafeExecution(run.id, { safeAddress: binding.safeAddress, safeTxHash: binding.safeTxHash, transactionData: binding.transactionData, executed: false, trusted: true });
      expect(pending.state).to.equal("AWAITING_APPROVAL");
      await expect(controller.reconcileSafeExecution(run.id, { safeAddress: binding.safeAddress, safeTxHash: `0x${"22".repeat(32)}`, transactionData: binding.transactionData, executed: false, trusted: true })).to.be.rejectedWith("does not match");
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
