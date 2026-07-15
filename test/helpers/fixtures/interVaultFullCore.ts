import { ethers } from "hardhat";
import { deployScriptTestFixture } from "../../integration/scripts/fixtures";

/**
 * Full-core InterVault fixture.
 *
 * The parent uses the real Beacon, ProxyGeneral, LiquidityManager,
 * ValueCalculator, TokenManager and ProtocolManager implementations. Only the
 * leaf is deterministic, so integration/E2E tests can inject yield and failure
 * without relying on external state.
 */
export async function deployInterVaultFullCoreFixture() {
  const core = await deployScriptTestFixture();
  const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
  const protocolManager = await ProtocolManager.deploy(await core.beacon.getAddress());
  await core.beacon.updateImplementation("ProtocolManager", await protocolManager.getAddress());
  await core.proxyGeneral.authorizeModule(await protocolManager.getAddress(), "ProtocolManager");

  const parentId = ethers.id("metavault:hardhat:WETH");
  const Registry = await ethers.getContractFactory("InterVaultRegistry");
  const registry = await Registry.deploy(await core.beacon.getAddress(), parentId);
  const Plugin = await ethers.getContractFactory("InterVaultPlugin");
  const plugin = await Plugin.deploy(await core.beacon.getAddress(), await registry.getAddress(), "WETH");
  const Lens = await ethers.getContractFactory("InterVaultLensAdapter");
  const lens = await Lens.deploy(await core.beacon.getAddress(), await registry.getAddress(), await plugin.getAddress(), "WETH");
  await registry.setPositionHolder(await plugin.getAddress());
  await core.beacon.updateImplementation("InterVaultRegistry", await registry.getAddress());
  await core.beacon.updateImplementation("InterVaultPlugin", await plugin.getAddress());
  await core.beacon.updateImplementation("InterVaultLensAdapter", await lens.getAddress());
  await core.beacon.updateImplementation("InterVault", await plugin.getAddress());
  await protocolManager.registerProtocol("InterVault", await plugin.getAddress(), await lens.getAddress(), await registry.getAddress());

  const ChildBeacon = await ethers.getContractFactory("MockBeacon");
  const childBeacon = await ChildBeacon.deploy();
  const Leaf = await ethers.getContractFactory("MockInterVaultLeaf");
  const leaf = await Leaf.deploy(await core.mockWETH.getAddress(), "Canonical WETH Leaf", "cWETH-LPT");
  await childBeacon.setImplementation("LiquidityManager", await leaf.getAddress());
  await childBeacon.setImplementation("ProxyGeneral", await leaf.getAddress());
  await childBeacon.setImplementation("ValueCalculator", await leaf.getAddress());
  await childBeacon.setImplementation("BASE_ASSET", await core.mockWETH.getAddress());

  const childId = ethers.id("leaf:hardhat:WETH");
  await registry.registerChild({
    childId,
    tokenCode: "WETH",
    assetId: ethers.id("hardhat:WETH"),
    childBeacon: await childBeacon.getAddress(),
    liquidityManager: await leaf.getAddress(),
    shareToken: await leaf.getAddress(),
    valueCalculator: await leaf.getAddress(),
    baseAsset: await core.mockWETH.getAddress(),
    manifestHash: ethers.id("hardhat-weth-leaf-manifest-v1"),
    chainId: 42161,
    assetDecimals: 18,
    maxExposureBps: 10_000,
    maxShareDeviationBps: 100,
    exitPriority: 1,
    maxDepositAssets: ethers.parseEther("1000"),
    active: true,
    depositsEnabled: true,
    withdrawalsEnabled: true,
    emergencyOnly: false,
  }, 0);

  return { ...core, protocolManager, registry, plugin, lens, childBeacon, leaf, childId, parentId };
}
