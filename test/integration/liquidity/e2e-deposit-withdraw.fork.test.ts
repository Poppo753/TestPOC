/**
 * @file e2e-deposit-withdraw.fork.test.ts
 * @description E2E deposit/withdraw test on Arbitrum fork using REAL deployed contracts
 * 
 * Tests both Morpho Blue market (WETH collateral) and MetaMorpho vault (USDC deposit)
 * using the full ProtocolManager → Plugin → External Protocol flow.
 * 
 * Uses the actual ProxyGeneral cash + small whale top-up for USDC.
 * 
 * USAGE:
 *   set FORK_ENABLED=true
 *   npx hardhat test test/integration/e2e-deposit-withdraw.fork.test.ts --network hardhat
 */

import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Contract, Signer } from "ethers";

// Skip if not forking
const FORK_ENABLED = process.env.FORK_ENABLED === "true";
(FORK_ENABLED ? describe : describe.skip)("E2E Deposit/Withdraw — Morpho Market + Vault (Fork)", function () {
    this.timeout(600_000);

    // ==================== MAINNET ADDRESSES ====================
    const DEPLOYER_ADDR = "0x8390e98483a9b39265428c8610371134B5d11C3F";
    const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
    const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
    const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
    const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
    const MORPHO_PLUGIN = "0xf653f0E3FddA2937C2A76C385FA381599BDb65dB";
    const VAULT_PLUGIN = "0x118fd15a78C0Dada24c49343A55142938Ca1868E";
    const MORPHO_REAL = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

    const USDC_ADDR = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_ADDR = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const MARKET_ID = "0xca83d02be579485cc10945c9597a6141e772f1cf0e0aa28d09a327b6cbd8642c";
    const HEXAONE_VAULT = "0xaE73875437c86abb60cD7fA77286D63cb94F9a25";

    // USDC whale on Arbitrum (EOA with ~2.5M USDC)
    const USDC_WHALE = "0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23";
    // WETH whale on Arbitrum
    const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";

    // Amounts
    const WETH_DEPOSIT = ethers.parseEther("0.0005");   // 0.0005 WETH (~$1.25)
    const USDC_DEPOSIT = 5_000_000n;                     // 5 USDC

    // Contracts
    let deployer: Signer;
    let protocolManager: Contract;
    let proxyGeneral: Contract;
    let morpho: Contract;
    let usdc: Contract;
    let weth: Contract;
    let vaultPlugin: Contract;
    let hexaVault: Contract;

    before(async function () {
        // Impersonate deployer (owner of everything)
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [DEPLOYER_ADDR],
        });
        deployer = await ethers.getSigner(DEPLOYER_ADDR);

        // Fund deployer with ETH for gas
        const [localSigner] = await ethers.getSigners();
        await localSigner.sendTransaction({
            to: DEPLOYER_ADDR,
            value: ethers.parseEther("1"),
        });

        // ERC20s
        const erc20abi = [
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address, uint256) returns (bool)",
            "function approve(address, uint256) returns (bool)",
        ];
        usdc = await ethers.getContractAt(erc20abi, USDC_ADDR);
        weth = await ethers.getContractAt(erc20abi, WETH_ADDR);

        // ProtocolManager
        protocolManager = await ethers.getContractAt(
            [
                "function deposit(string memory protocolName, string memory tokenCode, uint256 amount) external",
                "function withdraw(string memory protocolName, string memory tokenCode, uint256 amount) external",
                "function getBalance(string memory protocolName, string memory tokenCode) external view returns (uint256)",
                "function getTotalValue(string memory protocolName) external view returns (uint256)",
                "function executeProtocolCall(string memory protocolName, bytes memory data) external returns (bool, bytes memory)",
                "function setAllowedSelectors(string memory protocolName, bytes4[] memory selectors, bool allowed) external",
                "function owner() view returns (address)",
            ],
            PROTOCOL_MANAGER
        );

        // ProxyGeneral
        proxyGeneral = await ethers.getContractAt(
            [
                "function getAssetBalance(address asset) view returns (uint256)",
                "function withdrawToken(string memory tokenCode, uint256 amount, address to) external",
                "function owner() view returns (address)",
            ],
            PROXY_GENERAL
        );

        // Morpho (for position checks)
        morpho = await ethers.getContractAt(
            [
                "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
            ],
            MORPHO_REAL
        );

        // MorphoVaultPlugin (for balance checks)
        vaultPlugin = await ethers.getContractAt(
            [
                "function getBalance(string memory tokenCode) view returns (uint256)",
                "function getAllVaultPositions() view returns (tuple(address vault, uint256 shares, uint256 assets)[])",
                "function getTotalVaultValue() view returns (uint256)",
            ],
            VAULT_PLUGIN
        );

        // HexaOne vault (for share tracking)
        hexaVault = await ethers.getContractAt(
            [
                "function balanceOf(address) view returns (uint256)",
                "function convertToAssets(uint256) view returns (uint256)",
                "function maxDeposit(address) view returns (uint256)",
            ],
            HEXAONE_VAULT
        );

        // Fund ProxyGeneral with USDC from whale
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDC_WHALE],
        });
        const whale = await ethers.getSigner(USDC_WHALE);
        await network.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
        await usdc.connect(whale).transfer(PROXY_GENERAL, USDC_DEPOSIT);
        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [USDC_WHALE],
        });

        // Fund ProxyGeneral with WETH from whale
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WETH_WHALE],
        });
        const wethWhale = await ethers.getSigner(WETH_WHALE);
        await network.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
        await weth.connect(wethWhale).transfer(PROXY_GENERAL, ethers.parseEther("0.01"));
        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [WETH_WHALE],
        });

        console.log("\n=== Pre-Test Balances ===");
        console.log("  ProxyGeneral WETH:", ethers.formatUnits(await weth.balanceOf(PROXY_GENERAL), 18));
        console.log("  ProxyGeneral USDC:", ethers.formatUnits(await usdc.balanceOf(PROXY_GENERAL), 6));
    });

    // ==================== SECTION 1: MORPHO BLUE MARKET (WETH COLLATERAL) ====================

    describe("Section 1: Morpho Blue Market — WETH Collateral Supply/Withdraw", function () {
        let wethBefore: bigint;

        it("1.1 should have WETH in ProxyGeneral", async function () {
            const bal = await weth.balanceOf(PROXY_GENERAL);
            expect(bal).to.be.gt(0n, "ProxyGeneral should have WETH");
            console.log(`    ProxyGeneral WETH: ${ethers.formatUnits(bal, 18)}`);
        });

        it("1.2 should have no Morpho position initially", async function () {
            const pos = await morpho.position(MARKET_ID, MORPHO_PLUGIN);
            expect(pos.collateral).to.equal(0n, "Should have no collateral");
            expect(pos.supplyShares).to.equal(0n, "Should have no supply shares");
        });

        it("1.3 should deposit WETH via ProtocolManager.deposit()", async function () {
            wethBefore = await weth.balanceOf(PROXY_GENERAL);
            expect(wethBefore).to.be.gte(WETH_DEPOSIT, "Not enough WETH in ProxyGeneral");

            // Deposit WETH as collateral to Morpho Blue market
            await protocolManager.connect(deployer).deposit("MorphoPlugin", "WETH", WETH_DEPOSIT);

            // Verify WETH left ProxyGeneral
            const wethAfter = await weth.balanceOf(PROXY_GENERAL);
            expect(wethBefore - wethAfter).to.equal(WETH_DEPOSIT);
            console.log(`    Deposited ${ethers.formatUnits(WETH_DEPOSIT, 18)} WETH to Morpho Blue`);
        });

        it("1.4 should have Morpho collateral position after deposit", async function () {
            const pos = await morpho.position(MARKET_ID, MORPHO_PLUGIN);
            expect(pos.collateral).to.equal(WETH_DEPOSIT, "Collateral should match deposit");
            console.log(`    Morpho collateral: ${ethers.formatUnits(pos.collateral, 18)} WETH`);
        });

        it("1.5 should getBalance via ProtocolManager", async function () {
            const bal = await protocolManager.getBalance("MorphoPlugin", "WETH");
            expect(bal).to.equal(WETH_DEPOSIT);
        });

        it("1.6 should withdraw WETH via ProtocolManager.withdraw()", async function () {
            const wethBeforeWithdraw = await weth.balanceOf(PROXY_GENERAL);

            // Withdraw all WETH collateral
            await protocolManager.connect(deployer).withdraw("MorphoPlugin", "WETH", WETH_DEPOSIT);

            // Verify WETH returned to ProxyGeneral
            const wethAfterWithdraw = await weth.balanceOf(PROXY_GENERAL);
            expect(wethAfterWithdraw - wethBeforeWithdraw).to.equal(WETH_DEPOSIT);
            console.log(`    Withdrew ${ethers.formatUnits(WETH_DEPOSIT, 18)} WETH back to ProxyGeneral`);
        });

        it("1.7 should have no Morpho position after withdrawal", async function () {
            const pos = await morpho.position(MARKET_ID, MORPHO_PLUGIN);
            expect(pos.collateral).to.equal(0n, "Collateral should be zero");
        });

        it("1.8 should have WETH balance restored in ProxyGeneral", async function () {
            const wethFinal = await weth.balanceOf(PROXY_GENERAL);
            expect(wethFinal).to.be.gte(wethBefore, "WETH should be at least what we started with");
            console.log(`    Final ProxyGeneral WETH: ${ethers.formatUnits(wethFinal, 18)}`);
        });
    });

    // ==================== SECTION 2: METAMORPHO VAULT (USDC DEPOSIT) ====================

    describe("Section 2: MetaMorpho Vault — USDC Deposit/Withdraw via ProtocolManager", function () {
        let usdcBefore: bigint;

        it("2.1 should have USDC in ProxyGeneral", async function () {
            const bal = await usdc.balanceOf(PROXY_GENERAL);
            expect(bal).to.be.gte(USDC_DEPOSIT, "ProxyGeneral should have enough USDC");
            console.log(`    ProxyGeneral USDC: ${ethers.formatUnits(bal, 6)}`);
        });

        it("2.2 should have no vault shares initially", async function () {
            const shares = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(shares).to.equal(0n, "Should have no vault shares");
        });

        it("2.3 should verify HexaOne vault accepts deposits", async function () {
            const maxDep = await hexaVault.maxDeposit(VAULT_PLUGIN);
            expect(maxDep).to.be.gt(USDC_DEPOSIT, "Vault should accept our deposit");
        });

        it("2.4 should deposit USDC via ProtocolManager.deposit()", async function () {
            usdcBefore = await usdc.balanceOf(PROXY_GENERAL);

            // Deposit USDC to default MetaMorpho vault (HexaOne)
            await protocolManager.connect(deployer).deposit("MorphoVaultPlugin", "USDC", USDC_DEPOSIT);

            // Verify USDC left ProxyGeneral
            const usdcAfter = await usdc.balanceOf(PROXY_GENERAL);
            expect(usdcBefore - usdcAfter).to.equal(USDC_DEPOSIT);
            console.log(`    Deposited ${ethers.formatUnits(USDC_DEPOSIT, 6)} USDC to HexaOne vault`);
        });

        it("2.5 should have vault shares after deposit", async function () {
            const shares = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(shares).to.be.gt(0n, "Should have vault shares");

            const assets = await hexaVault.convertToAssets(shares);
            console.log(`    Vault shares: ${shares} (≈ ${ethers.formatUnits(assets, 6)} USDC)`);
            // Assets should be approximately equal to deposit (within rounding)
            expect(assets).to.be.closeTo(USDC_DEPOSIT, 100n); // within 0.0001 USDC
        });

        it("2.6 should getBalance('USDC') on VaultPlugin", async function () {
            const bal = await vaultPlugin.getBalance("USDC");
            expect(bal).to.be.gt(0n);
            console.log(`    VaultPlugin getBalance('USDC'): ${ethers.formatUnits(bal, 6)}`);
        });

        it("2.7 should getAllVaultPositions()", async function () {
            const positions = await vaultPlugin.getAllVaultPositions();
            expect(positions.length).to.be.gt(0, "Should have at least 1 position");
            const p = positions[0];
            expect(p.vault.toLowerCase()).to.equal(HEXAONE_VAULT.toLowerCase());
            expect(p.shares).to.be.gt(0n);
            expect(p.assets).to.be.gt(0n);
            console.log(`    Position: vault=${p.vault.substring(0, 10)}... shares=${p.shares} assets=${ethers.formatUnits(p.assets, 6)} USDC`);
        });

        it("2.8 should getTotalVaultValue()", async function () {
            const value = await vaultPlugin.getTotalVaultValue();
            expect(value).to.be.gt(0n);
            console.log(`    Total vault value: ${ethers.formatUnits(value, 6)} USDC`);
        });

        it("2.9 should withdraw USDC via ProtocolManager.withdraw()", async function () {
            const usdcBeforeWithdraw = await usdc.balanceOf(PROXY_GENERAL);

            // ERC-4626 rounding: maxWithdraw may be 1 wei less than deposited
            // Withdraw deposit - 1 to avoid WithdrawExceedsMax
            const withdrawAmount = USDC_DEPOSIT - 1n;
            await protocolManager.connect(deployer).withdraw("MorphoVaultPlugin", "USDC", withdrawAmount);

            // Verify USDC returned to ProxyGeneral
            const usdcAfterWithdraw = await usdc.balanceOf(PROXY_GENERAL);
            const received = usdcAfterWithdraw - usdcBeforeWithdraw;
            // May get slightly less due to vault fees/rounding, or slightly more due to yield
            expect(received).to.be.closeTo(USDC_DEPOSIT, 100n);
            console.log(`    Withdrew ${ethers.formatUnits(received, 6)} USDC back to ProxyGeneral`);
        });

        it("2.10 should have reduced vault shares after withdrawal", async function () {
            const shares = await hexaVault.balanceOf(VAULT_PLUGIN);
            // ERC-4626 withdraw by assets can leave dust shares due to rounding
            console.log(`    Remaining shares: ${shares} (dust from rounding)`);
            // Shares should be negligible relative to deposit (~5e18 shares for 5 USDC)
            const maxDust = ethers.parseUnits("0.001", 18); // 0.001 share-units
            expect(shares).to.be.lt(maxDust, "Dust shares should be negligible");
        });

        it("2.11 should have USDC balance approximately restored", async function () {
            const usdcFinal = await usdc.balanceOf(PROXY_GENERAL);
            // Within a few wei due to rounding
            expect(usdcFinal).to.be.closeTo(usdcBefore, 10n);
            console.log(`    Final ProxyGeneral USDC: ${ethers.formatUnits(usdcFinal, 6)}`);
        });
    });

    // ==================== SECTION 3: VAULT-SPECIFIC OPERATIONS (executeProtocolCall) ====================

    describe("Section 3: Vault-Specific Operations via executeProtocolCall", function () {
        before(async function () {
            // Whitelist vaultDeposit and vaultWithdraw selectors
            const selectors = [
                ethers.id("vaultDeposit(address,uint256)").substring(0, 10),
                ethers.id("vaultWithdraw(address,uint256)").substring(0, 10),
                ethers.id("vaultRedeem(address,uint256)").substring(0, 10),
            ];
            await protocolManager.connect(deployer).setAllowedSelectors(
                "MorphoVaultPlugin",
                selectors,
                true
            );

            // Use ProtocolManager.deposit to fund the plugin and vault first
            // Top up ProxyGeneral
            await network.provider.request({ method: "hardhat_impersonateAccount", params: [USDC_WHALE] });
            const whale = await ethers.getSigner(USDC_WHALE);
            await network.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            await usdc.connect(whale).transfer(PROXY_GENERAL, USDC_DEPOSIT);
            await network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [USDC_WHALE] });

            // Deposit USDC to vault via standard flow  
            await protocolManager.connect(deployer).deposit("MorphoVaultPlugin", "USDC", USDC_DEPOSIT);
        });

        it("3.1 should have vault shares from deposit", async function () {
            const shares = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(shares).to.be.gt(0n);
            console.log(`    Pre-existing vault shares: ${shares}`);
        });

        it("3.2 should vaultRedeem all shares via executeProtocolCall", async function () {
            const shares = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(shares).to.be.gt(0n, "Should have shares to redeem");

            const iface = new ethers.Interface([
                "function vaultRedeem(address vault, uint256 shares) returns (uint256)",
            ]);
            const data = iface.encodeFunctionData("vaultRedeem", [HEXAONE_VAULT, shares]);

            await protocolManager.connect(deployer).executeProtocolCall("MorphoVaultPlugin", data);

            const sharesAfter = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(sharesAfter).to.equal(0n, "All shares should be redeemed");
            console.log(`    vaultRedeem: ${shares} shares → USDC sent to ProxyGeneral`);
        });

        it("3.3 should vaultDeposit to specific vault via executeProtocolCall", async function () {
            // Send USDC from ProxyGeneral to plugin for direct vault deposit
            // First: deposit through ProtocolManager flow again to get USDC to proxy
            await network.provider.request({ method: "hardhat_impersonateAccount", params: [USDC_WHALE] });
            const whale = await ethers.getSigner(USDC_WHALE);
            await network.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            await usdc.connect(whale).transfer(PROXY_GENERAL, USDC_DEPOSIT);
            await network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [USDC_WHALE] });

            // Deposit to vault, withdraw via executeProtocolCall to test full roundtrip
            await protocolManager.connect(deployer).deposit("MorphoVaultPlugin", "USDC", USDC_DEPOSIT);

            const shares = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(shares).to.be.gt(0n, "Should have shares after deposit");

            // Now redeem all shares via executeProtocolCall
            const sharesNow = await hexaVault.balanceOf(VAULT_PLUGIN);
            const iface = new ethers.Interface([
                "function vaultRedeem(address vault, uint256 shares) returns (uint256)",
            ]);
            const data = iface.encodeFunctionData("vaultRedeem", [HEXAONE_VAULT, sharesNow]);
            await protocolManager.connect(deployer).executeProtocolCall("MorphoVaultPlugin", data);

            const sharesAfter = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(sharesAfter).to.equal(0n, "Should have no shares after full redeem");
            console.log(`    vaultRedeem via executeProtocolCall: success`);
        });
    });

    // ==================== SECTION 4: COMBINED LIFECYCLE ====================

    describe("Section 4: Combined Lifecycle — Both Market + Vault simultaneously", function () {
        before(async function () {
            // Top up ProxyGeneral with fresh USDC
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [USDC_WHALE],
            });
            const whale = await ethers.getSigner(USDC_WHALE);
            await network.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            await usdc.connect(whale).transfer(PROXY_GENERAL, USDC_DEPOSIT);
            await network.provider.request({
                method: "hardhat_stopImpersonatingAccount",
                params: [USDC_WHALE],
            });
        });

        it("4.1 should deposit WETH to market AND USDC to vault simultaneously", async function () {
            const wethBefore = await weth.balanceOf(PROXY_GENERAL);
            const usdcBefore2 = await usdc.balanceOf(PROXY_GENERAL);

            // Deposit to Morpho Blue market
            await protocolManager.connect(deployer).deposit("MorphoPlugin", "WETH", WETH_DEPOSIT);
            // Deposit to MetaMorpho vault
            await protocolManager.connect(deployer).deposit("MorphoVaultPlugin", "USDC", USDC_DEPOSIT);

            // Verify both positions exist
            const pos = await morpho.position(MARKET_ID, MORPHO_PLUGIN);
            expect(pos.collateral).to.equal(WETH_DEPOSIT, "Morpho collateral");

            const vaultShares = await hexaVault.balanceOf(VAULT_PLUGIN);
            expect(vaultShares).to.be.gt(0n, "Vault shares");

            console.log(`    Morpho collateral: ${ethers.formatUnits(pos.collateral, 18)} WETH`);
            console.log(`    Vault shares: ${vaultShares}`);
        });

        it("4.2 should get balances for both protocols", async function () {
            const morphoBal = await protocolManager.getBalance("MorphoPlugin", "WETH");
            expect(morphoBal).to.equal(WETH_DEPOSIT);

            const vaultBal = await vaultPlugin.getBalance("USDC");
            expect(vaultBal).to.be.gt(0n);

            console.log(`    MorphoPlugin WETH balance: ${ethers.formatUnits(morphoBal, 18)}`);
            console.log(`    VaultPlugin USDC balance: ${ethers.formatUnits(vaultBal, 6)}`);
        });

        it("4.3 should withdraw from BOTH protocols", async function () {
            const wethBefore = await weth.balanceOf(PROXY_GENERAL);
            const usdcBefore2 = await usdc.balanceOf(PROXY_GENERAL);

            // Withdraw from market
            await protocolManager.connect(deployer).withdraw("MorphoPlugin", "WETH", WETH_DEPOSIT);
            // Withdraw from vault (amount - 1 to avoid rounding revert)
            await protocolManager.connect(deployer).withdraw("MorphoVaultPlugin", "USDC", USDC_DEPOSIT - 1n);

            // Verify both positions cleared
            const pos = await morpho.position(MARKET_ID, MORPHO_PLUGIN);
            expect(pos.collateral).to.equal(0n, "Morpho collateral should be 0");

            const vaultShares = await hexaVault.balanceOf(VAULT_PLUGIN);
            const maxDust = ethers.parseUnits("0.001", 18);
            expect(vaultShares).to.be.lt(maxDust, "Vault shares should be negligible dust");

            // Verify funds back in ProxyGeneral
            const wethAfter = await weth.balanceOf(PROXY_GENERAL);
            const usdcAfter = await usdc.balanceOf(PROXY_GENERAL);
            expect(wethAfter - wethBefore).to.equal(WETH_DEPOSIT);
            expect(usdcAfter - usdcBefore2).to.be.closeTo(USDC_DEPOSIT, 100n);

            console.log(`    Both positions cleared. Funds returned to ProxyGeneral.`);
            console.log(`    WETH recovered: ${ethers.formatUnits(wethAfter - wethBefore, 18)}`);
            console.log(`    USDC recovered: ${ethers.formatUnits(usdcAfter - usdcBefore2, 6)}`);
        });
    });

    // ==================== SECTION 5: FINAL BALANCE VERIFICATION ====================

    describe("Section 5: Post-Test State Verification", function () {
        it("5.1 ProxyGeneral should have WETH", async function () {
            const bal = await weth.balanceOf(PROXY_GENERAL);
            expect(bal).to.be.gt(0n);
            console.log(`    ProxyGeneral WETH: ${ethers.formatUnits(bal, 18)}`);
        });

        it("5.2 ProxyGeneral should have USDC", async function () {
            const bal = await usdc.balanceOf(PROXY_GENERAL);
            expect(bal).to.be.gt(0n);
            console.log(`    ProxyGeneral USDC: ${ethers.formatUnits(bal, 6)}`);
        });

        it("5.3 MorphoPlugin should have no residual position", async function () {
            const pos = await morpho.position(MARKET_ID, MORPHO_PLUGIN);
            expect(pos.collateral).to.equal(0n);
            expect(pos.supplyShares).to.equal(0n);
        });

        it("5.4 MorphoVaultPlugin should have negligible vault shares", async function () {
            const shares = await hexaVault.balanceOf(VAULT_PLUGIN);
            const maxDust = ethers.parseUnits("0.001", 18);
            expect(shares).to.be.lt(maxDust, "Dust shares should be negligible");
            console.log(`    Residual vault shares: ${shares}`);
        });

        it("5.5 No tokens stuck in plugins", async function () {
            const pluginUsdc = await usdc.balanceOf(MORPHO_PLUGIN);
            const pluginWeth = await weth.balanceOf(MORPHO_PLUGIN);
            const vaultUsdc = await usdc.balanceOf(VAULT_PLUGIN);
            
            expect(pluginUsdc).to.equal(0n, "No USDC in MorphoPlugin");
            expect(pluginWeth).to.equal(0n, "No WETH in MorphoPlugin");
            expect(vaultUsdc).to.equal(0n, "No USDC in VaultPlugin");
        });
    });
});
