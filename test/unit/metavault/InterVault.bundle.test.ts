import { expect } from "chai";
import { ethers } from "hardhat";

describe("InterVault three-musketeers bundle", function () {
  const USDC = (value: string) => ethers.parseUnits(value, 6);
  const WETH = (value: string) => ethers.parseUnits(value, 18);
  const manifestHash = ethers.keccak256(ethers.toUtf8Bytes("leaf-manifest-v1"));
  const assetId = ethers.keccak256(ethers.toUtf8Bytes("arbitrum:USDC"));
  const parentId = ethers.keccak256(ethers.toUtf8Bytes("meta:arbitrum:USDC"));

  async function fixture() {
    const [owner, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const usdc = await Token.deploy("USD Coin", "USDC", 6);
    const weth = await Token.deploy("Wrapped Ether", "WETH", 18);

    const Beacon = await ethers.getContractFactory("MockBeacon");
    const parentBeacon = await Beacon.deploy();
    const childBeacon = await Beacon.deploy();
    const Proxy = await ethers.getContractFactory("MockProxyGeneral");
    const parentProxy = await Proxy.deploy();
    await parentProxy.setTokenAddress("USDC", await usdc.getAddress());
    await parentProxy.setTokenAddress("WETH", await weth.getAddress());

    const Tokens = await ethers.getContractFactory("MockTokenManager");
    const tokenManager = await Tokens.deploy();
    await tokenManager.setTokenAddress("WETH", await weth.getAddress());
    await tokenManager.setTokenPrice("USDC", 100_000_000n);
    await tokenManager.setTokenPrice("WETH", 3000n * 100_000_000n);
    await tokenManager.setBaseAssetCode("USDC");

    const ParentValue = await ethers.getContractFactory("MockInterVaultValueCalculator");
    const parentValue = await ParentValue.deploy();
    await parentValue.setValue(USDC("900"));

    const PM = await ethers.getContractFactory("ProtocolManager");
    const protocolManager = await PM.deploy(await parentBeacon.getAddress());
    await parentBeacon.setImplementation("ProtocolManager", await protocolManager.getAddress());
    await parentBeacon.setImplementation("ProxyGeneral", await parentProxy.getAddress());
    await parentBeacon.setImplementation("BASE_ASSET", await usdc.getAddress());
    await parentBeacon.setImplementation("TokenManager", await tokenManager.getAddress());
    await parentBeacon.setImplementation("ValueCalculator", await parentValue.getAddress());

    const Registry = await ethers.getContractFactory("InterVaultRegistry");
    const registry = await Registry.deploy(await parentBeacon.getAddress(), parentId);
    const Plugin = await ethers.getContractFactory("InterVaultPlugin");
    const plugin = await Plugin.deploy(await parentBeacon.getAddress(), await registry.getAddress(), "USDC");
    const Lens = await ethers.getContractFactory("InterVaultLensAdapter");
    const lens = await Lens.deploy(await parentBeacon.getAddress(), await registry.getAddress(), await plugin.getAddress(), "USDC");
    await registry.setPositionHolder(await plugin.getAddress());
    await parentBeacon.setImplementation("InterVaultPlugin", await plugin.getAddress());
    await parentBeacon.setImplementation("InterVaultRegistry", await registry.getAddress());
    await parentBeacon.setImplementation("InterVaultLensAdapter", await lens.getAddress());
    await parentBeacon.setImplementation("InterVault", await plugin.getAddress());
    await protocolManager.registerProtocol("InterVault", await plugin.getAddress(), await lens.getAddress(), await registry.getAddress());

    const Leaf = await ethers.getContractFactory("MockInterVaultLeaf");
    const usdcLeaf = await Leaf.deploy(await usdc.getAddress(), "Leaf USDC Share", "lUSDC");
    await childBeacon.setImplementation("LiquidityManager", await usdcLeaf.getAddress());
    await childBeacon.setImplementation("ProxyGeneral", await usdcLeaf.getAddress());
    await childBeacon.setImplementation("ValueCalculator", await usdcLeaf.getAddress());
    await childBeacon.setImplementation("BASE_ASSET", await usdc.getAddress());
    const usdcChildId = ethers.keccak256(ethers.toUtf8Bytes("leaf:arbitrum:USDC"));
    const usdcChild = {
      childId: usdcChildId,
      tokenCode: "USDC",
      assetId,
      childBeacon: await childBeacon.getAddress(),
      liquidityManager: await usdcLeaf.getAddress(),
      shareToken: await usdcLeaf.getAddress(),
      valueCalculator: await usdcLeaf.getAddress(),
      baseAsset: await usdc.getAddress(),
      manifestHash,
      chainId: 42161,
      assetDecimals: 6,
      maxExposureBps: 9000,
      maxShareDeviationBps: 100,
      exitPriority: 1,
      maxDepositAssets: USDC("10000"),
      active: true,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      emergencyOnly: false,
    };
    await registry.registerChild(usdcChild, 0);
    await usdc.transfer(await parentProxy.getAddress(), USDC("10000"));
    return { owner, other, usdc, weth, parentBeacon, parentProxy, parentValue, protocolManager, registry, plugin, lens, childBeacon, usdcLeaf, usdcChild, usdcChildId, Leaf, Beacon };
  }

  it("registers a deterministic L0 child and exposes the canonical token route", async function () {
    const { registry, usdcChildId, usdcLeaf } = await fixture();
    expect(await registry.getChildCount()).to.equal(1);
    expect((await registry.getChildForToken("USDC")).childId).to.equal(usdcChildId);
    expect((await registry.getChild(usdcChildId)).shareToken).to.equal(await usdcLeaf.getAddress());
  });

  it("rejects a second canonical child for the same real token", async function () {
    const { registry, usdcChild } = await fixture();
    const duplicate = { ...usdcChild, childId: ethers.keccak256(ethers.toUtf8Bytes("second")) };
    await expect(registry.registerChild(duplicate, 0)).to.be.revertedWithCustomError(registry, "TokenAlreadyAssigned");
  });

  it("rejects a token-code alias that points to the same real ERC-20", async function () {
    const { registry, usdc, Leaf, Beacon } = await fixture();
    const aliasLeaf = await Leaf.deploy(await usdc.getAddress(), "Alias Leaf", "ALIAS");
    const aliasBeacon = await Beacon.deploy();
    for (const name of ["LiquidityManager", "ProxyGeneral", "ValueCalculator"]) {
      await aliasBeacon.setImplementation(name, await aliasLeaf.getAddress());
    }
    await aliasBeacon.setImplementation("BASE_ASSET", await usdc.getAddress());
    await expect(registry.registerChild({
      childId: ethers.id("alias-usdc-child"), tokenCode: "USDC_ALIAS", assetId: ethers.id("arbitrum:USDC:alias"),
      childBeacon: await aliasBeacon.getAddress(), liquidityManager: await aliasLeaf.getAddress(),
      shareToken: await aliasLeaf.getAddress(), valueCalculator: await aliasLeaf.getAddress(), baseAsset: await usdc.getAddress(),
      manifestHash, chainId: 42161, assetDecimals: 6, maxExposureBps: 1000, maxShareDeviationBps: 100,
      exitPriority: 3, maxDepositAssets: USDC("10"), active: true, depositsEnabled: true,
      withdrawalsEnabled: true, emergencyOnly: false,
    }, 0)).to.be.revertedWithCustomError(registry, "AssetAlreadyAssigned");
  });

  it("rejects a child that itself exposes InterVault capability", async function () {
    const { registry, weth, Leaf, Beacon } = await fixture();
    const leaf = await Leaf.deploy(await weth.getAddress(), "Bad Leaf", "BAD");
    const beacon = await Beacon.deploy();
    for (const name of ["LiquidityManager", "ProxyGeneral", "ValueCalculator"]) await beacon.setImplementation(name, await leaf.getAddress());
    await beacon.setImplementation("BASE_ASSET", await weth.getAddress());
    await beacon.setImplementation("InterVaultPlugin", await leaf.getAddress());
    const child = {
      childId: ethers.keccak256(ethers.toUtf8Bytes("bad-child")), tokenCode: "WETH",
      assetId: ethers.keccak256(ethers.toUtf8Bytes("arbitrum:WETH")), childBeacon: await beacon.getAddress(),
      liquidityManager: await leaf.getAddress(), shareToken: await leaf.getAddress(), valueCalculator: await leaf.getAddress(),
      baseAsset: await weth.getAddress(), manifestHash, chainId: 42161, assetDecimals: 18,
      maxExposureBps: 5000, maxShareDeviationBps: 100, exitPriority: 2, maxDepositAssets: WETH("10"),
      active: true, depositsEnabled: true, withdrawalsEnabled: true, emergencyOnly: false,
    };
    await expect(registry.registerChild(child, 0)).to.be.revertedWithCustomError(registry, "ChildHasInterVaultCapability");
  });

  it("revalidates child Beacon integrity before every new deposit", async function () {
    const { protocolManager, plugin, childBeacon, usdcLeaf } = await fixture();
    await childBeacon.setImplementation("InterVaultPlugin", await usdcLeaf.getAddress());
    await expect(protocolManager.deposit("InterVault", "USDC", USDC("1")))
      .to.be.revertedWithCustomError(plugin, "ChildHasInterVaultCapability");
  });

  it("uses the unchanged ProtocolManager API and holds child shares in the Plugin", async function () {
    const { protocolManager, plugin, parentProxy, usdc, usdcLeaf, usdcChildId } = await fixture();
    await expect(protocolManager.deposit("InterVault", "USDC", USDC("100")))
      .to.emit(plugin, "ChildDeposited");
    expect(await usdcLeaf.balanceOf(await plugin.getAddress())).to.equal(USDC("100"));
    expect(await usdc.balanceOf(await parentProxy.getAddress())).to.equal(USDC("9900"));
    expect(await plugin.getChildShares(usdcChildId)).to.equal(USDC("100"));
    expect(await usdc.allowance(await plugin.getAddress(), await usdcLeaf.getAddress())).to.equal(0);
  });

  it("redeems underlying through ProtocolManager and returns it to parent custody", async function () {
    const { protocolManager, plugin, parentProxy, usdc, usdcLeaf } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("100"));
    await protocolManager.withdraw("InterVault", "USDC", USDC("40"));
    expect(await usdc.balanceOf(await parentProxy.getAddress())).to.equal(USDC("9940"));
    expect(await usdcLeaf.balanceOf(await plugin.getAddress())).to.equal(USDC("60"));
  });

  it("blocks direct callers and deposits above the prospective exposure cap", async function () {
    const { other, plugin, registry, usdcChildId, protocolManager, parentValue } = await fixture();
    await expect(plugin.connect(other).deposit("USDC", USDC("1"))).to.be.revertedWithCustomError(plugin, "OnlyProtocolManager");
    await registry.updatePolicy(usdcChildId, 1000, USDC("10000"), 100, 1);
    await parentValue.setValue(USDC("800"));
    await expect(protocolManager.deposit("InterVault", "USDC", USDC("100"))).to.be.revertedWithCustomError(plugin, "ExposureCapExceeded");
  });

  it("reverts atomically when received shares violate Registry tolerance", async function () {
    const { protocolManager, plugin, parentProxy, usdc, usdcLeaf } = await fixture();
    await usdcLeaf.setShareHaircutBps(500);
    const before = await usdc.balanceOf(await parentProxy.getAddress());
    await expect(protocolManager.deposit("InterVault", "USDC", USDC("100"))).to.be.revertedWithCustomError(plugin, "InsufficientSharesOut");
    expect(await usdc.balanceOf(await parentProxy.getAddress())).to.equal(before);
    expect(await usdcLeaf.balanceOf(await plugin.getAddress())).to.equal(0);
  });

  it("keeps deprecated positions visible and prevents removal before zero balance", async function () {
    const { protocolManager, registry, lens, usdcChildId } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("100"));
    await registry.updateStatus(usdcChildId, false, false, true, false);
    expect(await lens.getTotalValue()).to.equal(USDC("100"));
    await expect(registry.removeChild(usdcChildId)).to.be.revertedWithCustomError(registry, "ChildHasBalance");
  });

  it("enforces Registry lifecycle without losing the withdrawal path", async function () {
    const { protocolManager, registry, plugin, usdcChildId } = await fixture();
    await registry.updateStatus(usdcChildId, false, false, true, false);
    await expect(protocolManager.deposit("InterVault", "USDC", USDC("1")))
      .to.be.revertedWithCustomError(plugin, "ChildInactive");
    await registry.updateStatus(usdcChildId, true, true, true, false);
    await protocolManager.deposit("InterVault", "USDC", USDC("10"));
    await registry.updateStatus(usdcChildId, false, false, true, false);
    await protocolManager.withdraw("InterVault", "USDC", USDC("10"));
    expect((await plugin.getActiveChildIds()).length).to.equal(0);
  });

  it("allows Registry removal only after the Plugin share balance is zero", async function () {
    const { protocolManager, registry, usdcChildId } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("10"));
    await protocolManager.withdraw("InterVault", "USDC", USDC("10"));
    await expect(registry.removeChild(usdcChildId)).to.emit(registry, "ChildRemoved");
    expect(await registry.isChildRegistered(usdcChildId)).to.equal(false);
  });

  it("records the current core skip-on-Lens-error limitation as a deployment gate", async function () {
    const { protocolManager, usdcLeaf, lens } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("10"));
    await usdcLeaf.setFailReads(true);
    await expect(lens.getTotalValue()).to.be.revertedWith("mock read failure");
    // This is deliberately asserted rather than hidden: the unchanged core
    // skips a failed Lens and would report zero. Real deployment remains gated.
    expect(await protocolManager.getAllProtocolsValue()).to.equal(0);
  });

  it("values USDC and WETH leaf positions in the parent USDC denomination", async function () {
    const f = await fixture();
    await f.protocolManager.deposit("InterVault", "USDC", USDC("100"));
    const wethBeacon = await f.Beacon.deploy();
    const wethLeaf = await f.Leaf.deploy(await f.weth.getAddress(), "Leaf WETH", "lWETH");
    for (const name of ["LiquidityManager", "ProxyGeneral", "ValueCalculator"]) await wethBeacon.setImplementation(name, await wethLeaf.getAddress());
    await wethBeacon.setImplementation("BASE_ASSET", await f.weth.getAddress());
    const wethId = ethers.keccak256(ethers.toUtf8Bytes("leaf:arbitrum:WETH"));
    await f.registry.registerChild({
      childId: wethId, tokenCode: "WETH", assetId: ethers.keccak256(ethers.toUtf8Bytes("arbitrum:WETH")),
      childBeacon: await wethBeacon.getAddress(), liquidityManager: await wethLeaf.getAddress(), shareToken: await wethLeaf.getAddress(),
      valueCalculator: await wethLeaf.getAddress(), baseAsset: await f.weth.getAddress(), manifestHash, chainId: 42161,
      assetDecimals: 18, maxExposureBps: 10000, maxShareDeviationBps: 100, exitPriority: 2,
      maxDepositAssets: WETH("10"), active: true, depositsEnabled: true, withdrawalsEnabled: true, emergencyOnly: false,
    }, 0);
    await f.weth.transfer(await f.parentProxy.getAddress(), WETH("1"));
    await f.parentValue.setValue(USDC("1000"));
    await f.protocolManager.deposit("InterVault", "WETH", WETH("1"));
    expect((await f.lens.getChildPosition(wethId)).valueInParentBase).to.equal(USDC("3000"));
    expect(await f.lens.getTotalValue()).to.equal(USDC("3100"));
  });

  it("removes the active runtime entry after a full unwind", async function () {
    const { protocolManager, plugin } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("100"));
    await protocolManager.withdraw("InterVault", "USDC", USDC("100"));
    expect((await plugin.getActiveChildIds()).length).to.equal(0);
  });

  it("uses the stable child ID when ProtocolManager closes a position", async function () {
    const { protocolManager, plugin, usdcChildId, usdcLeaf } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("25"));
    await protocolManager.closePosition("InterVault", BigInt(usdcChildId));
    expect(await usdcLeaf.balanceOf(await plugin.getAddress())).to.equal(0);
    expect((await plugin.getActiveChildIds()).length).to.equal(0);
  });

  it("uses the same stable child ID for Lens risk and health reads", async function () {
    const { protocolManager, lens, usdcChildId } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("1"));
    const positions = await lens.getPositionsSortedByRisk();
    expect(positions[0].positionId).to.equal(BigInt(usdcChildId));
    expect((await lens.getPositionHealth(positions[0].positionId)).isHealthy).to.equal(true);
    await expect(lens.getPositionHealth(123n)).to.be.revertedWithCustomError(lens, "InvalidPosition");
  });

  it("keeps a failed emergency child observable and can unwind it on retry", async function () {
    const { protocolManager, plugin, usdcLeaf, usdcChildId } = await fixture();
    await protocolManager.deposit("InterVault", "USDC", USDC("25"));
    await usdcLeaf.setStatus(true, false);
    await expect(protocolManager.emergencyWithdrawAll("InterVault", ["USDC"]))
      .to.emit(plugin, "ChildEmergencyWithdrawFailed");
    expect(await plugin.getChildShares(usdcChildId)).to.equal(USDC("25"));
    expect((await plugin.getActiveChildIds()).length).to.equal(1);

    await usdcLeaf.setStatus(true, true);
    await expect(protocolManager.emergencyWithdrawAll("InterVault", ["USDC"]))
      .to.emit(plugin, "ChildEmergencyWithdrawn");
    expect(await plugin.getChildShares(usdcChildId)).to.equal(0);
    expect((await plugin.getActiveChildIds()).length).to.equal(0);
  });

  it("rejects an uncensused real token even from the configured ProtocolManager", async function () {
    const { other, parentBeacon, plugin, registry } = await fixture();
    await parentBeacon.setImplementation("ProtocolManager", other.address);
    await expect(plugin.connect(other).deposit("NOT_REGISTERED", 1))
      .to.be.revertedWithCustomError(registry, "ChildNotFound");
  });
});
