import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import { ethers } from "hardhat";
import { deployCore } from "../../../scripts/operations/deployment/deploy-core";
import { deployBundle } from "../../../scripts/operations/deployment/deploy-bundle";
import { loadManifest } from "../../../scripts/framework/manifest";

const forkEnabled = process.env.FORK_ENABLED === "true";

(forkEnabled ? describe : describe.skip)("InterVault fixed fork: new parent over the real USDC POC leaf", function () {
  this.timeout(600_000);

  const POC_PATH = "scripts/manifests/arbitrum-usdc-poc-1.json";
  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const USDC_FEED = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";
  const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
  let snapshot: string;
  let temporaryManifest: string;

  before(async function () {
    expect(process.env.FORK_BLOCK_NUMBER, "FORK_BLOCK_NUMBER must be explicitly fixed").to.match(/^\d+$/);
    expect(Number(process.env.FORK_BLOCK_NUMBER), "fork block predates the certified POC").to.be.gte(483_832_997);
    snapshot = await ethers.provider.send("evm_snapshot", []);
    temporaryManifest = path.join(os.tmpdir(), `inter-vault-parent-fork-${Date.now()}.json`);
  });

  after(async function () {
    if (snapshot) await ethers.provider.send("evm_revert", [snapshot]);
    if (temporaryManifest) fs.rmSync(temporaryManifest, { force: true });
  });

  it("round-trips through the deployed POC LiquidityManager and returns to zero leaf shares", async function () {
    const hre = require("hardhat");
    const childManifest = loadManifest(POC_PATH);
    for (const key of ["beacon", "liquidityManager", "proxyGeneral", "valueCalculator"] as const) {
      expect(await ethers.provider.getCode(childManifest.contracts[key]), `${key} has no fork bytecode`).to.not.equal("0x");
    }

    const parentManifest = await deployCore(hre, {
      manifestPath: temporaryManifest,
      baseAssetCode: "USDC",
      baseAssetAddress: USDC,
      baseAssetDecimals: 6,
      basePriceFeed: USDC_FEED,
      basePriceFeedDecimals: 8,
      basePriceHeartbeat: 86_400,
      execute: true,
      confirmations: 1,
    });
    await deployBundle(hre, {
      kind: "inter-vault",
      manifest: parentManifest,
      manifestPath: temporaryManifest,
      execute: true,
      confirmations: 1,
      addresses: {},
    });

    const registry = await ethers.getContractAt("InterVaultRegistry", parentManifest.contracts.interVaultRegistry);
    const plugin = await ethers.getContractAt("InterVaultPlugin", parentManifest.contracts.interVaultPlugin);
    const lens = await ethers.getContractAt("InterVaultLensAdapter", parentManifest.contracts.interVaultLensAdapter);
    const manager = await ethers.getContractAt("ProtocolManager", parentManifest.contracts.protocolManager);
    const childId = ethers.id("leaf:arbitrum:usdc-poc-1");
    const manifestHash = ethers.keccak256(ethers.toUtf8Bytes(fs.readFileSync(POC_PATH, "utf8")));
    await registry.registerChild({
      childId,
      tokenCode: "USDC",
      assetId: ethers.id("arbitrum:USDC"),
      childBeacon: childManifest.contracts.beacon,
      liquidityManager: childManifest.contracts.liquidityManager,
      shareToken: childManifest.contracts.proxyGeneral,
      valueCalculator: childManifest.contracts.valueCalculator,
      baseAsset: USDC,
      manifestHash,
      chainId: 42161,
      assetDecimals: 6,
      maxExposureBps: 10_000,
      maxShareDeviationBps: 200,
      exitPriority: 1,
      maxDepositAssets: ethers.parseUnits("5", 6),
      active: true,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      emergencyOnly: false,
    }, 0);

    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("1"))]);
    const whale = await ethers.getSigner(USDC_WHALE);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    await usdc.connect(whale).transfer(parentManifest.contracts.proxyGeneral, ethers.parseUnits("2", 6));
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);

    await manager.deposit("InterVault", "USDC", ethers.parseUnits("1", 6));
    const childLpt = await ethers.getContractAt("IERC20", childManifest.contracts.proxyGeneral);
    expect(await childLpt.balanceOf(await plugin.getAddress())).to.be.gt(0n);
    expect(await lens.getTotalValue()).to.be.gt(0n);
    expect(await manager.getBalance("InterVault", "USDC")).to.be.gt(0n);

    await manager.closePosition("InterVault", BigInt(childId));
    expect(await childLpt.balanceOf(await plugin.getAddress())).to.equal(0n);
    expect(await plugin.getActiveChildIds()).to.deep.equal([]);
    expect(await lens.getTotalValue()).to.equal(0n);
  });
});
