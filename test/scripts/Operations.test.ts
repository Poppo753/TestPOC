import { expect } from "chai";
import { ethers } from "hardhat";
import { emptyManifest, setContract } from "../../scripts/framework/manifest";
import type { Address, ScriptRuntime } from "../../scripts/framework/types";
import { updateBeaconModule } from "../../scripts/operations/administration/beacon";
import { setEmergencyState } from "../../scripts/operations/administration/emergency";
import { configureCorePolicy } from "../../scripts/operations/administration/core-policy";
import { registerProtocol, setProtocolActive, setSelectorWhitelist } from "../../scripts/operations/administration/protocols";
import { configureAaveToken, configureEulerVault, configureMorphoMarket, configureMorphoVault, transferRegistryOwnership } from "../../scripts/operations/administration/registries";
import { configureOracleFeed, configureToken } from "../../scripts/operations/administration/tokens";
import { getProtocolHealth } from "../../scripts/operations/monitoring/protocol-health";
import { getSystemStatus } from "../../scripts/operations/monitoring/system-status";
import { executeProtocolAction, readProtocolPosition } from "../../scripts/operations/protocols/positions";
import { depositToVault } from "../../scripts/operations/vault/deposit";
import { withdrawFromVault } from "../../scripts/operations/vault/withdraw";
import { swapVaultAssets } from "../../scripts/operations/vault/swap";
import { getInterVaultPositions, preflightInterVault, registerInterVaultChild, updateInterVaultPolicy, updateInterVaultStatus } from "../../scripts/operations/metavault/inter-vault";
import { deployScriptTestFixture, ScriptTestHelpers } from "../integration/scripts/fixtures";

describe("Operational scripts: local integration", function () {
  this.timeout(180_000);
  let fixture: Awaited<ReturnType<typeof deployScriptTestFixture>>;
  let runtime: ScriptRuntime;
  let snapshot: string;

  before(async function () {
    fixture = await deployScriptTestFixture();
    const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
    const protocolManager = await ProtocolManager.deploy(await fixture.beacon.getAddress());
    await fixture.beacon.updateImplementation("ProtocolManager", await protocolManager.getAddress());
    await fixture.proxyGeneral.authorizeModule(await protocolManager.getAddress(), "ProtocolManager");
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "WETH", baseAssetAddress: await fixture.mockWETH.getAddress(), baseAssetDecimals: 18, deployer: fixture.owner.address });
    for (const [name, contract] of Object.entries({ beacon: fixture.beacon, proxyGeneral: fixture.proxyGeneral, tokenManager: fixture.tokenManager,
      valueCalculator: fixture.valueCalculator, parameterManager: fixture.parameterManager, liquidityManager: fixture.liquidityManager,
      swapManager: fixture.swapManager, emergencyHandler: fixture.emergencyHandler, protocolManager })) {
      setContract(manifest, name, await contract.getAddress());
    }
    runtime = { provider: ethers.provider, signer: fixture.owner, signerAddress: fixture.owner.address as Address, chainId: 42161,
      networkName: "hardhat", manifest, options: { execute: true, dryRun: false, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] } };
  });
  beforeEach(async function () { snapshot = await ScriptTestHelpers.snapshot(); });
  afterEach(async function () { await ScriptTestHelpers.restore(snapshot); });

  it("executes deposit and withdrawal with exact share post-checks", async function () {
    const amount = ethers.parseEther("1");
    const before = await fixture.proxyGeneral.balanceOf(fixture.owner.address);
    const deposited = await depositToVault(runtime, { amount, wrapNative: true });
    expect(deposited.success).to.equal(true);
    const afterDeposit = await fixture.proxyGeneral.balanceOf(fixture.owner.address);
    expect(afterDeposit).to.be.gt(before);
    const shares = (afterDeposit - before) / 2n;
    const withdrawn = await withdrawFromVault(runtime, { shares });
    expect(withdrawn.success).to.equal(true);
    expect(await fixture.proxyGeneral.balanceOf(fixture.owner.address)).to.equal(afterDeposit - shares);
  });

  it("generates encode-only deposit calldata without changing balances", async function () {
    const encoded: ScriptRuntime = { ...runtime, signer: undefined, options: { ...runtime.options, execute: false, encodeOnly: true } };
    const before = await fixture.proxyGeneral.balanceOf(fixture.owner.address);
    const result = await depositToVault(encoded, { amount: 1n, caller: fixture.owner.address });
    expect(result.success).to.equal(true);
    expect(result.plan?.calls.map(call => call.id)).to.deep.equal(["approve-liquidity", "deposit"]);
    expect(await fixture.proxyGeneral.balanceOf(fixture.owner.address)).to.equal(before);
  });

  it("reports deterministic system and protocol health", async function () {
    const status = await getSystemStatus(runtime);
    expect(status.modules.ProtocolManager.hasCode).to.equal(true);
    expect(status.operations.depositsEnabled).to.equal(true);
    const health = await getProtocolHealth(runtime);
    expect(health.protocolNames).to.deep.equal([]);
  });

  it("updates Beacon and verifies implementation history", async function () {
    const replacement = await (await ethers.getContractFactory("MockWETH")).deploy();
    const old = await fixture.beacon.getImplementation("ValueCalculator");
    const result = await updateBeaconModule(runtime, "ValueCalculator", await replacement.getAddress());
    expect(result.success).to.equal(true);
    expect(await fixture.beacon.getImplementation("ValueCalculator")).to.equal(await replacement.getAddress());
    expect(await fixture.beacon.getImplementationHistory("ValueCalculator")).to.include(old);
  });

  it("registers a protocol, selectors and active state", async function () {
    const address = await fixture.mockWETH.getAddress();
    const registered = await registerProtocol(runtime, { name: "Mock", plugin: address, lensAdapter: address });
    expect(registered.success, JSON.stringify(registered.error)).to.equal(true);
    const selectors = await setSelectorWhitelist(runtime, "Mock", ["deposit(string,uint256)"], true);
    expect(selectors.success, JSON.stringify(selectors.error)).to.equal(true);
    const inactive = await setProtocolActive(runtime, "Mock", false);
    expect(inactive.success, JSON.stringify(inactive.error)).to.equal(true);
    expect((await runtime.provider.call({ to: runtime.manifest.contracts.protocolManager,
      data: (await ethers.getContractFactory("ProtocolManager")).interface.encodeFunctionData("getProtocolInfo", ["Mock"]) })).length).to.be.gt(2);
  });

  it("configures token and all supported registry shapes", async function () {
    await fixture.mockOracle.setupToken("USDC", ethers.parseEther("1"), 18, true);
    const token = await configureToken(runtime, { code: "USDC", address: await fixture.mockUSDC.getAddress(), decimals: 6, heartbeat: 3600n });
    expect(token.success, JSON.stringify(token.error)).to.equal(true);
    const aave = await (await ethers.getContractFactory("AaveV3Registry")).deploy();
    const euler = await (await ethers.getContractFactory("EulerRegistry")).deploy();
    const morpho = await (await ethers.getContractFactory("MorphoRegistry")).deploy();
    setContract(runtime.manifest, "aaveV3Registry", await aave.getAddress()); setContract(runtime.manifest, "eulerRegistry", await euler.getAddress()); setContract(runtime.manifest, "morphoRegistry", await morpho.getAddress());
    const usdc = await fixture.mockUSDC.getAddress(); const weth = await fixture.mockWETH.getAddress();
    expect((await configureAaveToken(runtime, "USDC", usdc, usdc, usdc)).success).to.equal(true);
    expect((await configureEulerVault(runtime, "USDC", usdc)).success).to.equal(true);
    expect((await configureMorphoMarket(runtime, { collateralCode: "WETH", loanCode: "USDC", collateralToken: weth, loanToken: usdc, oracle: weth, irm: usdc, lltv: 860000000000000000n })).success).to.equal(true);
    expect((await configureMorphoVault(runtime, "USDC", usdc, true)).success).to.equal(true);
  });

  it("configures a non-base asset oracle feed independently from token metadata", async function () {
    const adapter = await (await ethers.getContractFactory("ChainlinkAdapter")).deploy();
    const feed = await (await ethers.getContractFactory("MockChainlinkAggregator")).deploy(8, 2500n * 10n ** 8n);
    setContract(runtime.manifest, "chainlinkAdapter", await adapter.getAddress());
    const result = await configureOracleFeed(runtime, { code: "WETH", feed: await feed.getAddress(), feedDecimals: 8, heartbeat: 3600n });
    expect(result.success, JSON.stringify(result.error)).to.equal(true);
    expect(await adapter.supportsToken("WETH")).to.equal(true);
  });

  it("simulates emergency before sending and can execute pause", async function () {
    const simulated = await setEmergencyState({ ...runtime, options: { ...runtime.options, dryRun: true } }, true, "test");
    expect(simulated.success).to.equal(true);
    expect(simulated.transactions[0].status).to.equal("simulated");
    expect(await fixture.proxyGeneral.isPaused()).to.equal(false);
    const executed = await setEmergencyState(runtime, true, "test");
    expect(executed.success).to.equal(true);
    expect(await fixture.proxyGeneral.isPaused()).to.equal(true);
  });

  it("swaps custody assets through the best plugin and verifies both balance deltas", async function () {
    await fixture.mockOracle.setupToken("USDC", ethers.parseEther("1"), 18, true);
    await fixture.mockOracle.setupToken("WBTC", ethers.parseEther("1"), 18, true);
    expect((await configureToken(runtime, { code: "USDC", address: await fixture.mockUSDC.getAddress(), decimals: 6, heartbeat: 3600n })).success).to.equal(true);
    expect((await configureToken(runtime, { code: "WBTC", address: await fixture.mockWBTC.getAddress(), decimals: 8, heartbeat: 3600n })).success).to.equal(true);
    const plugin = await (await ethers.getContractFactory("MockSimpleSwap")).deploy();
    await fixture.beacon.updateImplementation("MockSwapPlugin", await plugin.getAddress());
    await plugin.setCustodyHolder(await fixture.proxyGeneral.getAddress());
    const amountIn = 1_000_000n; const amountOut = 100_000n;
    await plugin.setExpectedOutput(await fixture.mockUSDC.getAddress(), await fixture.mockWBTC.getAddress(), amountOut);
    await fixture.mockUSDC.transfer(await fixture.proxyGeneral.getAddress(), amountIn);
    await fixture.mockWBTC.transfer(await plugin.getAddress(), amountOut);
    const result = await swapVaultAssets(runtime, { tokenIn: "USDC", tokenOut: "WBTC", amountIn, maxSlippageBps: 100 });
    expect(result.success, JSON.stringify(result.error)).to.equal(true);
    expect(BigInt(result.data?.tokenInBefore ?? 0n) - BigInt(result.data?.tokenInAfter ?? 0n)).to.equal(amountIn);
    expect(BigInt(result.data?.tokenOutAfter ?? 0n) - BigInt(result.data?.tokenOutBefore ?? 0n)).to.equal(amountOut);
  });

  it("executes the full protocol deposit/withdraw/borrow/repay/close lifecycle", async function () {
    await fixture.mockOracle.setupToken("USDC", ethers.parseEther("1"), 18, true);
    expect((await configureToken(runtime, { code: "USDC", address: await fixture.mockUSDC.getAddress(), decimals: 6, heartbeat: 3600n })).success).to.equal(true);
    const plugin = await (await ethers.getContractFactory("MockOperationalProtocol")).deploy(await fixture.proxyGeneral.getAddress(), await fixture.mockUSDC.getAddress());
    const registered = await registerProtocol(runtime, { name: "OperationalMock", plugin: await plugin.getAddress(), lensAdapter: await plugin.getAddress() });
    expect(registered.success, JSON.stringify(registered.error)).to.equal(true);
    await fixture.mockUSDC.transfer(await fixture.proxyGeneral.getAddress(), 1_000n);
    for (const [operation, amount] of [["deposit", 500n], ["withdraw", 100n], ["borrow", 200n], ["repay", 50n]] as const) {
      const result = await executeProtocolAction(runtime, { operation, protocolName: "OperationalMock", tokenCode: "USDC", amount });
      expect(result.success, `${operation}: ${JSON.stringify(result.error)}`).to.equal(true);
    }
    const position = await readProtocolPosition(runtime, "OperationalMock", "USDC");
    expect(position.balance).to.equal("400");
    expect(position.debt).to.equal("150");
    const closed = await executeProtocolAction(runtime, { operation: "close", protocolName: "OperationalMock", debtTokenCode: "USDC", collateralTokenCode: "USDC" });
    expect(closed.success, JSON.stringify(closed.error)).to.equal(true);
    expect((await readProtocolPosition(runtime, "OperationalMock", "USDC")).debt).to.equal("0");
  });

  it("reads yield-only Morpho Vault positions without calling lending selectors", async function () {
    const plugin = await (await ethers.getContractFactory("MockOperationalProtocol")).deploy(await fixture.proxyGeneral.getAddress(), await fixture.mockUSDC.getAddress());
    const registered = await registerProtocol(runtime, { name: "YieldOnly", plugin: await plugin.getAddress(), lensAdapter: await plugin.getAddress() });
    expect(registered.success, JSON.stringify(registered.error)).to.equal(true);
    runtime.manifest.protocols.YieldOnly = {
      plugin: await plugin.getAddress() as Address,
      lensAdapter: await plugin.getAddress() as Address,
      active: true,
      kind: "morpho-vault",
    };
    const position = await readProtocolPosition(runtime, "YieldOnly", "USDC");
    expect(position.balance).to.equal("0");
    expect(position.debt).to.equal("0");
    expect(position.healthFactor).to.equal(((1n << 256n) - 1n).toString());
  });

  it("configures explicit fees, limits, rates and operation flags as one ordered policy", async function () {
    const result = await configureCorePolicy(runtime, {
      feeRecipient: fixture.feeRecipient.address, depositFeeBps: 25, withdrawFeeBps: 50,
      depositsEnabled: true, withdrawsEnabled: true, swapsEnabled: true,
      hourlyWithdrawLimit: 1_000_000n, dailyWithdrawLimit: 10_000_000n, minWithdraw: 1n, maxWithdraw: 100_000n,
      swapTokenCode: "USDC", minSwapAmount: 1n, maxSwapAmount: 1_000_000n, maxSlippageBps: 200,
      depositRatePerUser: 1_000_000n, depositRateGlobal: 10_000_000n, withdrawRatePerUser: 1_000_000n, withdrawRateGlobal: 10_000_000n,
    });
    expect(result.success, JSON.stringify(result.error)).to.equal(true);
    expect(result.transactions).to.have.length(11);
    expect(await fixture.liquidityManager.depositFee()).to.equal(25n);
  });

  it("transfers registry ownership only through the explicit final step", async function () {
    const registry = await (await ethers.getContractFactory("AaveV3Registry")).deploy();
    const nextOwner = await (await ethers.getContractFactory("MockWETH")).deploy();
    setContract(runtime.manifest, "aaveV3Registry", await registry.getAddress());
    const result = await transferRegistryOwnership(runtime, "aaveV3Registry", await nextOwner.getAddress());
    expect(result.success, JSON.stringify(result.error)).to.equal(true);
    expect(await registry.owner()).to.equal(await nextOwner.getAddress());
  });

  it("registers and operates a canonical InterVault child through neutral script plans", async function () {
    const parentId = ethers.id("script-parent");
    const childId = ethers.id("script-child-weth");
    const registry = await (await ethers.getContractFactory("InterVaultRegistry")).deploy(await fixture.beacon.getAddress(), parentId);
    const plugin = await (await ethers.getContractFactory("InterVaultPlugin")).deploy(
      await fixture.beacon.getAddress(), await registry.getAddress(), "WETH"
    );
    const lens = await (await ethers.getContractFactory("InterVaultLensAdapter")).deploy(
      await fixture.beacon.getAddress(), await registry.getAddress(), await plugin.getAddress(), "WETH"
    );
    await registry.setPositionHolder(await plugin.getAddress());
    setContract(runtime.manifest, "interVaultRegistry", await registry.getAddress());
    setContract(runtime.manifest, "interVaultPlugin", await plugin.getAddress());
    setContract(runtime.manifest, "interVaultLensAdapter", await lens.getAddress());
    runtime.manifest.protocols.InterVault = {
      plugin: await plugin.getAddress() as Address,
      lensAdapter: await lens.getAddress() as Address,
      registry: await registry.getAddress() as Address,
      active: true,
      kind: "inter-vault",
    };

    const registered = await registerInterVaultChild(runtime, {
      childId,
      tokenCode: "WETH",
      assetId: ethers.id("WETH"),
      childBeacon: await fixture.beacon.getAddress() as Address,
      liquidityManager: await fixture.liquidityManager.getAddress() as Address,
      shareToken: await fixture.proxyGeneral.getAddress() as Address,
      valueCalculator: await fixture.valueCalculator.getAddress() as Address,
      baseAsset: await fixture.mockWETH.getAddress() as Address,
      manifestHash: ethers.id("script-child-manifest"),
      assetDecimals: 18,
      maxExposureBps: 2_500,
      maxShareDeviationBps: 100,
      exitPriority: 10,
      maxDepositAssets: ethers.parseEther("10"),
    });
    expect(registered.success, JSON.stringify(registered.error)).to.equal(true);
    expect((await updateInterVaultPolicy(runtime, { childId, maxExposureBps: 3_000, maxDepositAssets: ethers.parseEther("20"), maxShareDeviationBps: 50, exitPriority: 5 })).success).to.equal(true);
    expect((await updateInterVaultStatus(runtime, { childId, active: false, depositsEnabled: false, withdrawalsEnabled: true, emergencyOnly: false })).success).to.equal(true);

    const preflight = await preflightInterVault(runtime);
    expect(preflight).to.deep.equal({ valid: true, findings: [] });
    const positions = await getInterVaultPositions(runtime);
    expect(positions.totalValue).to.equal("0");
    expect(positions.positions).to.have.length(1);
  });
});
