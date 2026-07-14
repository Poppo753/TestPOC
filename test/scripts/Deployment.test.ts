import { expect } from "chai";
import os from "os";
import path from "path";
import { ethers } from "hardhat";
import { deployCore } from "../../scripts/operations/deployment/deploy-core";
import { deployBundle } from "../../scripts/operations/deployment/deploy-bundle";

describe("Operational scripts: deployment", function () {
  this.timeout(300_000);

  it("deploys, registers, authorizes and checkpoints the complete core", async function () {
    const base = await (await ethers.getContractFactory("MockWETH")).deploy();
    const feed = await (await ethers.getContractFactory("MockChainlinkAggregator")).deploy(8, 300000000000n);
    const manifestPath = path.join(os.tmpdir(), `project4-script-manifest-${Date.now()}.json`);
    const manifest = await deployCore(require("hardhat"), { manifestPath, baseAssetCode: "WETH", baseAssetAddress: await base.getAddress(), baseAssetDecimals: 18,
      basePriceFeed: await feed.getAddress(), basePriceFeedDecimals: 8, basePriceHeartbeat: 3600, execute: true });
    expect(manifest.metadata.coreDeploymentComplete).to.equal(true);
    expect(Object.keys(manifest.contracts)).to.include.members(["beacon", "proxyGeneral", "liquidityManager", "protocolManager", "flashLoanService"]);
    const beacon = await ethers.getContractAt("Beacon", manifest.contracts.beacon);
    expect(await beacon.getImplementation("LiquidityManager")).to.equal(manifest.contracts.liquidityManager);
    const proxy = await ethers.getContractAt("ProxyGeneral", manifest.contracts.proxyGeneral);
    expect(await proxy.isAuthorizedModule(manifest.contracts.protocolManager)).to.equal(true);
  });

  it("refuses unfinished Dolomite and GMX bundles", async function () {
    const base = await (await ethers.getContractFactory("MockWETH")).deploy();
    const feed = await (await ethers.getContractFactory("MockChainlinkAggregator")).deploy(8, 300000000000n);
    const manifestPath = path.join(os.tmpdir(), `project4-script-reject-${Date.now()}.json`);
    const manifest = await deployCore(require("hardhat"), { manifestPath, baseAssetCode: "WETH", baseAssetAddress: await base.getAddress(), baseAssetDecimals: 18,
      basePriceFeed: await feed.getAddress(), basePriceFeedDecimals: 8, basePriceHeartbeat: 3600, execute: true });
    for (const kind of ["dolomite", "gmx"] as const) {
      let error: Error | undefined;
      try { await deployBundle(require("hardhat"), { kind, manifest, manifestPath, execute: true, addresses: {} }); } catch (caught) { error = caught as Error; }
      expect(error?.message).to.include("intentionally unsupported");
    }
  });

  it("deploys and registers every supported bundle", async function () {
    const dependency = await (await ethers.getContractFactory("MockWETH")).deploy();
    const feed = await (await ethers.getContractFactory("MockChainlinkAggregator")).deploy(8, 300000000000n);
    const manifestPath = path.join(os.tmpdir(), `project4-script-bundles-${Date.now()}.json`);
    const manifest = await deployCore(require("hardhat"), { manifestPath, baseAssetCode: "WETH", baseAssetAddress: await dependency.getAddress(), baseAssetDecimals: 18,
      basePriceFeed: await feed.getAddress(), basePriceFeedDecimals: 8, basePriceHeartbeat: 3600, execute: true });
    const external = await dependency.getAddress();
    await deployBundle(require("hardhat"), { kind: "uniswap-v3", manifest, manifestPath, execute: true, addresses: { router: external, quoterV2: external } });
    await deployBundle(require("hardhat"), { kind: "aave", manifest, manifestPath, execute: true, addresses: { pool: external } });
    await deployBundle(require("hardhat"), { kind: "euler", manifest, manifestPath, execute: true, addresses: { evc: external, accountLens: external, vaultLens: external, utilsLens: external } });
    await deployBundle(require("hardhat"), { kind: "morpho", manifest, manifestPath, execute: true, addresses: { morpho: external } });
    await deployBundle(require("hardhat"), { kind: "morpho-vault", manifest, manifestPath, execute: true, addresses: {} });
    expect(Object.keys(manifest.protocols)).to.have.members(["AaveV3", "EulerV2", "Morpho", "MorphoVault"]);
    expect(manifest.contracts.uniswapV3PluginDirect).to.match(/^0x[0-9a-fA-F]{40}$/);
  });
});
