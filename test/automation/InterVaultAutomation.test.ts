import { expect } from "chai";
import fs from "fs";
import path from "path";
import { ethers } from "hardhat";
import { emptyManifest, setContract } from "../../scripts/framework/manifest";
import type { Address, ScriptRuntime } from "../../scripts/framework/types";
import { observeVault } from "../../scripts/automation/observer";
import { runAutomationPreflight } from "../../scripts/automation/preflight";
import { VaultAutomationController } from "../../scripts/automation/controller";
import { JsonAutomationStore } from "../../scripts/automation/store";
import type { AutomationConfig } from "../../scripts/automation/types";
import { deployInterVaultFullCoreFixture } from "../helpers/fixtures/interVaultFullCore";

describe("Vault Automation Controller: InterVault monitor-only integration", function () {
  this.timeout(180_000);

  async function setup() {
    const f = await deployInterVaultFullCoreFixture();
    const manifest = emptyManifest({
      network: "hardhat",
      chainId: 42161,
      baseAssetCode: "WETH",
      baseAssetAddress: await f.mockWETH.getAddress(),
      baseAssetDecimals: 18,
      deployer: f.owner.address,
    });
    for (const [name, contract] of Object.entries({
      beacon: f.beacon,
      proxyGeneral: f.proxyGeneral,
      tokenManager: f.tokenManager,
      valueCalculator: f.valueCalculator,
      parameterManager: f.parameterManager,
      liquidityManager: f.liquidityManager,
      swapManager: f.swapManager,
      emergencyHandler: f.emergencyHandler,
      protocolManager: f.protocolManager,
      interVaultRegistry: f.registry,
      interVaultPlugin: f.plugin,
      interVaultLensAdapter: f.lens,
    })) setContract(manifest, name, await contract.getAddress());
    manifest.protocols.InterVault = {
      plugin: await f.plugin.getAddress() as Address,
      lensAdapter: await f.lens.getAddress() as Address,
      registry: await f.registry.getAddress() as Address,
      active: true,
      kind: "inter-vault",
    };
    const runtime: ScriptRuntime = {
      provider: ethers.provider,
      signer: f.owner,
      signerAddress: f.owner.address as Address,
      chainId: 42161,
      networkName: "hardhat",
      manifest,
      options: { execute: false, dryRun: true, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] },
    };
    const directory = path.join(process.cwd(), ".automation-test-state", `inter-vault-${Date.now()}`);
    const config: AutomationConfig = {
      schemaVersion: 1,
      vaultId: "inter-vault-automation-test",
      chainId: 42161,
      manifestPath: "unused-in-imported-test",
      mode: "observe",
      baseAssetCode: "WETH",
      baseAssetDecimals: 18,
      protocols: [{ name: "InterVault", enabled: false, targetBps: 0, maxBps: 0 }],
      policy: {
        reserveTargetBps: 10_000,
        reserveMinimumBps: 9_000,
        rebalanceThresholdBps: 100,
        minimumActionAmount: "1",
        maxMovementBpsPerCycle: 100,
        cooldownSeconds: 0,
        maxPlanAgeBlocks: 100,
        maxStateDriftBps: 5,
        maxObservationBlockSpan: 10,
        minHealthFactor: ethers.parseEther("1.5").toString(),
        requireOracleFreshness: false,
        supplyOnly: true,
        verificationToleranceBps: 100,
      },
      autonomous: { enabled: false, acknowledgement: "" },
      execution: { kind: "disabled" },
      runtime: {
        stateDirectory: directory,
        intervalSeconds: 300,
        lockTtlSeconds: 900,
        confirmations: 1,
        rpcRetries: 0,
        rpcRetryDelayMs: 0,
        heartbeatPath: path.join(directory, "heartbeat.json"),
        maxConsecutiveFailures: 2,
      },
    };
    return { f, runtime, config, directory };
  }

  it("includes the complete Lens value in observation, fingerprint and persisted observe run", async function () {
    const { f, runtime, config, directory } = await setup();
    try {
      await f.protocolManager.deposit("InterVault", "WETH", ethers.parseEther("4"));
      const preflight = await runAutomationPreflight(runtime, config);
      expect(preflight.ready, preflight.checks.filter(item => item.status === "FAIL").map(item => item.message).join("; ")).to.equal(true);
      expect(preflight.checks.map(item => item.id)).to.include.members([
        "PROTOCOL_InterVault_HOLDER", "PROTOCOL_InterVault_CHILDREN", "PROTOCOL_InterVault_VALUATION",
      ]);

      const first = await observeVault(runtime, config);
      expect(first.protocols[0].balance).to.equal(ethers.parseEther("4").toString());
      expect(first.managedAssets).to.equal((await f.valueCalculator.getTotalPoolValueView()).toString());
      const yieldAmount = ethers.parseEther("0.1");
      await f.mockWETH.connect(f.user1).deposit({ value: yieldAmount });
      await f.mockWETH.connect(f.user1).approve(await f.leaf.getAddress(), yieldAmount);
      await f.leaf.connect(f.user1).donate(yieldAmount);
      const second = await observeVault(runtime, config);
      expect(second.fingerprint).to.not.equal(first.fingerprint);
      expect(BigInt(second.managedAssets) - BigInt(first.managedAssets)).to.equal(yieldAmount);

      const store = new JsonAutomationStore(directory);
      const run = await new VaultAutomationController(runtime, config, store).runCycle();
      expect(run.state).to.equal("OBSERVED_ONLY");
      expect(store.get(run.id).observation?.fingerprint).to.equal(run.observation?.fingerprint);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when a policy attempts to fund InterVault before its valuation gate is closed", async function () {
    const { runtime, config, directory } = await setup();
    const fundingConfig: AutomationConfig = {
      ...config,
      protocols: [{ name: "InterVault", enabled: true, targetBps: 1_000, maxBps: 1_000 }],
      policy: { ...config.policy, reserveTargetBps: 9_000, reserveMinimumBps: 8_000 },
    };
    try {
      const preflight = await runAutomationPreflight(runtime, fundingConfig);
      expect(preflight.ready).to.equal(false);
      expect(preflight.checks.filter(item => item.status === "FAIL").map(item => item.id)).to.include("PROTOCOL_InterVault_KIND");
      await expect(observeVault(runtime, fundingConfig)).to.be.rejectedWith("unsupported by the supply-only automation POC");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
