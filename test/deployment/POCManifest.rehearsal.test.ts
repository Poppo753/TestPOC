import { expect } from "chai";
import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";

/**
 * Certifies the exact contracts produced by deploy-core/deploy-bundle on a
 * persistent Arbitrum fork. Unlike the protocol fixtures, this test consumes a
 * real deployment manifest and therefore catches missing wiring, aliases and
 * post-deploy registry configuration.
 *
 * The test is deliberately opt-in and local-fork-only:
 *   $env:POC_MANIFEST="scripts/manifests/rehearsal-....json"
 *   npx hardhat test test/deployment/POCManifest.rehearsal.test.ts --network localhost
 *
 * Whale funds exist only inside the fork. A snapshot is reverted in `after`,
 * so repeated certification runs start from the same deployed state.
 */
const manifestInput = process.env.POC_MANIFEST;
const enabled = Boolean(manifestInput);

(enabled ? describe : describe.skip)("POC manifest — persistent fork certification", function () {
  this.timeout(300_000);

  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
  const WETH_WHALE = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";
  const MORPHO_USDC_VAULT = "0xaE73875437c86abb60cD7fA77286D63cb94F9a25";

  let manifest: any;
  let snapshot: string;

  before(async function () {
    if (network.name !== "localhost") throw new Error("POC manifest certification requires --network localhost");
    const manifestPath = path.resolve(manifestInput as string);
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.chainId).to.equal(42161);
    snapshot = await ethers.provider.send("evm_snapshot", []);
    await ethers.provider.send("hardhat_impersonateAccount", [manifest.deployer]);
    await ethers.provider.send("hardhat_setBalance", [manifest.deployer, ethers.toQuantity(ethers.parseEther("1"))]);
  });

  after(async function () {
    if (manifest?.deployer) await ethers.provider.send("hardhat_stopImpersonatingAccount", [manifest.deployer]);
    if (snapshot) await ethers.provider.send("evm_revert", [snapshot]);
  });

  async function fundFromWhale(token: string, whaleAddress: string, recipient: string, amount: bigint) {
    await ethers.provider.send("hardhat_impersonateAccount", [whaleAddress]);
    await ethers.provider.send("hardhat_setBalance", [whaleAddress, ethers.toQuantity(ethers.parseEther("1"))]);
    const whale = await ethers.getSigner(whaleAddress);
    const erc20 = await ethers.getContractAt("IERC20", token);
    await (await erc20.connect(whale).transfer(recipient, amount)).wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [whaleAddress]);
  }

  it("matches bytecode, aliases and the separated Euler roles", async function () {
    for (const address of Object.values(manifest.contracts) as string[]) {
      expect(await ethers.provider.getCode(address), `missing bytecode at ${address}`).to.not.equal("0x");
    }
    const beacon = await ethers.getContractAt("Beacon", manifest.contracts.beacon);
    for (const protocol of ["AaveV3", "EulerV2", "Morpho", "MorphoVault"]) {
      expect(await beacon.getImplementation(protocol)).to.equal(manifest.protocols[protocol].plugin);
    }
    const registry = await ethers.getContractAt("EulerRegistry", manifest.contracts.eulerRegistry);
    expect(await registry.owner()).to.equal(manifest.deployer);
    expect(await registry.positionManagers(manifest.contracts.eulerV2Plugin)).to.equal(true);
  });

  it("round-trips every configured protocol and leaves no tracked position", async function () {
    const proxy = manifest.contracts.proxyGeneral;
    await fundFromWhale(USDC, USDC_WHALE, proxy, ethers.parseUnits("5", 6));
    await fundFromWhale(WETH, WETH_WHALE, proxy, ethers.parseEther("0.002"));

    const deployer = await ethers.getSigner(manifest.deployer);
    const manager = (await ethers.getContractAt("ProtocolManager", manifest.contracts.protocolManager)).connect(deployer);

    for (const protocol of ["AaveV3", "EulerV2", "MorphoVault"]) {
      await (await manager.deposit(protocol, "USDC", ethers.parseUnits("1", 6))).wait();
      const balance = await manager.getBalance(protocol, "USDC");
      expect(balance).to.be.greaterThan(0n);
      await (await manager.withdraw(protocol, "USDC", balance)).wait();
    }

    await (await manager.deposit("Morpho", "WETH", ethers.parseEther("0.001"))).wait();
    const morphoBalance = await manager.getBalance("Morpho", "WETH");
    expect(morphoBalance).to.equal(ethers.parseEther("0.001"));
    await (await manager.withdraw("Morpho", "WETH", morphoBalance)).wait();

    // ERC-4626 convertToAssets can round one micro-unit down during a nominal
    // withdraw. closePosition redeems the exact remaining shares, which is the
    // required final cleanup path and must clear both value and active tracking.
    const morphoVault = (await ethers.getContractAt("MorphoVaultPlugin", manifest.contracts.morphoVaultPlugin)).connect(deployer);
    if (await morphoVault.getVaultShares(MORPHO_USDC_VAULT) > 0n) {
      await (await morphoVault.closePosition(0)).wait();
    }

    expect(await manager.getBalance("AaveV3", "USDC")).to.equal(0n);
    expect(await manager.getBalance("EulerV2", "USDC")).to.equal(0n);
    expect(await manager.getBalance("Morpho", "WETH")).to.equal(0n);
    expect(await morphoVault.getVaultShares(MORPHO_USDC_VAULT)).to.equal(0n);
    expect(await morphoVault.getActiveVaultCount()).to.equal(0n);
    expect(await manager.getBalance("MorphoVault", "USDC")).to.equal(0n);
  });
});
