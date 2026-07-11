import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * FORK TEST per MorphoVaultPlugin + Registry condiviso + MorphoVaultLensAdapter
 * 
 * Verifica tutte le operazioni vault ERC-4626 su fork Arbitrum reale:
 * - Registry: configureVault, setDefaultVault, isVaultApproved, removeVault
 * - Plugin: deposit (IProtocolAdapter), withdraw (IProtocolAdapter), vaultDeposit, vaultWithdraw, vaultRedeem
 * - LensAdapter: getTotalValue, getHealthFactor, getProtocolSummary, etc.
 * - Access Control: onlyProtocolManager, circuit breaker, vault approval
 * - Custody Model: plugin holds shares, assets go to/from ProxyGeneral
 * 
 * SETUP:
 *   $env:FORK_ENABLED="true"; npx hardhat test test/integration/MorphoVaultPlugin.fork.test.ts
 * 
 * NOTA: Usa il vault REALE "MEV Capital USDC" su Arbitrum
 */

describe("MorphoVault Plugin - Comprehensive Fork Tests (Arbitrum Mainnet)", function () {
    this.timeout(300000);

    // ==================== CONTRACTS ====================
    let registry: any;
    let vaultPlugin: any;
    let vaultLensAdapter: any;
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;

    // ==================== SIGNERS ====================
    let owner: SignerWithAddress;
    let other: SignerWithAddress;

    // ==================== TOKEN CONTRACTS ====================
    let usdcContract: any;

    // ==================== ARBITRUM MAINNET ADDRESSES ====================

    // Tokens
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

    // Real MetaMorpho vaults on Arbitrum (must have maxDeposit > 0)
    const HEXAONE_USDC_VAULT   = "0xaE73875437c86abb60cD7fA77286D63cb94F9a25";  // ~57 USDC, maxDeposit ~200K
    const CLEARSTAR_USDC_VAULT = "0xa53Cf822FE93002aEaE16d395CD823Ece161a6AC";  // ~24K USDC, maxDeposit ~10T

    // Whale for impersonation (Aave pool — has lots of USDC)
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // Test amounts
    const DEPOSIT_AMOUNT = ethers.parseUnits("100", 6);   // 100 USDC
    const WITHDRAW_AMOUNT = ethers.parseUnits("50", 6);    // 50 USDC
    const SMALL_DEPOSIT = ethers.parseUnits("10", 6);      // 10 USDC

    // ==================== SETUP ====================

    before(async function () {
        // Skip if not on fork
        const network = await ethers.provider.getNetwork();
        if (process.env.FORK_ENABLED !== "true" && network.chainId !== 42161n) {
            console.log("⚠️  Skipping fork tests - not running on Arbitrum fork");
            console.log("   Run with: $env:FORK_ENABLED=\"true\"; npx hardhat test test/integration/MorphoVaultPlugin.fork.test.ts");
            this.skip();
        }

        [owner, other] = await ethers.getSigners();
        console.log("\n🔧 Setting up MorphoVault Fork Test Environment...");
        console.log(`   Owner: ${owner.address}`);

        // ==================== TOKEN CONTRACTS ====================
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        // ==================== VERIFY REAL VAULT EXISTS ====================
        const vaultCode = await ethers.provider.getCode(HEXAONE_USDC_VAULT);
        if (vaultCode === "0x") {
            console.log("   ❌ HexaOne USDC vault not found on fork");
            this.skip();
        }
        console.log(`   ✅ HexaOne USDC vault found (${(vaultCode.length - 2) / 2} bytes)`);

        // Verify it's ERC-4626 and accepts deposits
        const realVault = new ethers.Contract(HEXAONE_USDC_VAULT, [
            "function asset() view returns (address)",
            "function totalAssets() view returns (uint256)",
            "function maxDeposit(address) view returns (uint256)",
        ], ethers.provider);
        const vaultAsset = await realVault.asset();
        expect(vaultAsset.toLowerCase()).to.equal(USDC.toLowerCase());
        const totalAssets = await realVault.totalAssets();
        console.log(`   ✅ ERC-4626 confirmed. TotalAssets: ${ethers.formatUnits(totalAssets, 6)} USDC`);
        const maxDep = await realVault.maxDeposit(ethers.ZeroAddress);
        console.log(`   ✅ maxDeposit: ${ethers.formatUnits(maxDep, 6)} USDC`);
        if (maxDep === 0n) {
            console.log("   ❌ Vault not accepting deposits");
            this.skip();
        }

        // ==================== DEPLOY MOCK INFRA ====================

        const MockBeaconFactory = await ethers.getContractFactory("MockBeacon");
        mockBeacon = await MockBeaconFactory.deploy();
        await mockBeacon.waitForDeployment();

        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        mockTokenManager = await MockTokenManagerFactory.deploy();
        await mockTokenManager.waitForDeployment();

        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();
        await mockProxyGeneral.waitForDeployment();

        // Configure mock beacon
        await mockBeacon.setImplementation("TokenManager", await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral", await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager", owner.address);
        await mockBeacon.setImplementation("LiquidityManager", owner.address);
        await mockBeacon.setImplementation("WETH", WETH);
        await mockBeacon.setImplementation("BASE_ASSET", WETH);

        // Configure mock token manager
        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenAddress("USDC", USDC);

        // Set ETH price for LensAdapter calculations (~$2500)
        const ethPriceUsd = ethers.parseUnits("2500", 8);
        await mockTokenManager.setTokenPrice("WETH", ethPriceUsd);
        await mockTokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8)); // $1

        // ==================== DEPLOY MORPHO REGISTRY ====================

        const RegistryFactory = await ethers.getContractFactory("MorphoRegistry");
        registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();

        // Configure vaults in Registry
        await registry.configureVault(HEXAONE_USDC_VAULT, "USDC");
        await registry.configureVault(CLEARSTAR_USDC_VAULT, "USDC");

        // Set default vault for USDC
        await registry.setDefaultVault("USDC", HEXAONE_USDC_VAULT);

        await mockBeacon.setImplementation("MorphoRegistry", await registry.getAddress());

        // ==================== DEPLOY MORPHO VAULT PLUGIN ====================

        const VaultPluginFactory = await ethers.getContractFactory("MorphoVaultPlugin");
        vaultPlugin = await VaultPluginFactory.deploy(await mockBeacon.getAddress());
        await vaultPlugin.waitForDeployment();
        await mockBeacon.setImplementation("MorphoVaultPlugin", await vaultPlugin.getAddress());

        // ==================== DEPLOY MORPHO VAULT LENS ADAPTER ====================

        const VaultLensFactory = await ethers.getContractFactory("MorphoVaultLensAdapter");
        vaultLensAdapter = await VaultLensFactory.deploy(await mockBeacon.getAddress(), "WETH");
        await vaultLensAdapter.waitForDeployment();
        await mockBeacon.setImplementation("MorphoVaultLensAdapter", await vaultLensAdapter.getAddress());

        // ==================== FUND THE VAULT PLUGIN WITH USDC ====================

        // Impersonate whale and send USDC to the plugin
        await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
        const whale = await ethers.getSigner(USDC_WHALE);
        await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        const pluginAddr = await vaultPlugin.getAddress();
        await usdcContract.connect(whale).transfer(pluginAddr, ethers.parseUnits("1000", 6));

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);

        console.log(`\n   Registry:          ${await registry.getAddress()}`);
        console.log(`   VaultPlugin:       ${pluginAddr}`);
        console.log(`   VaultLensAdapter:  ${await vaultLensAdapter.getAddress()}`);
        console.log(`   MockProxy:         ${await mockProxyGeneral.getAddress()}`);
        console.log(`   Plugin USDC bal:   ${ethers.formatUnits(await usdcContract.balanceOf(pluginAddr), 6)} USDC`);
        console.log("✅ Setup completato!\n");
    });

    // ================================================================
    // 1. REGISTRY VAULT TESTS
    // ================================================================

    describe("1. MorphoRegistry — Vault Configuration", function () {
        it("1.1 Should have HexaOne vault configured", async function () {
            const config = await registry.getVaultConfig(HEXAONE_USDC_VAULT);
            expect(config.vault).to.equal(HEXAONE_USDC_VAULT);
            expect(config.assetCode).to.equal("USDC");
            expect(config.isActive).to.be.true;
        });

        it("1.2 Should have Clearstar vault configured", async function () {
            const config = await registry.getVaultConfig(CLEARSTAR_USDC_VAULT);
            expect(config.vault).to.equal(CLEARSTAR_USDC_VAULT);
            expect(config.assetCode).to.equal("USDC");
            expect(config.isActive).to.be.true;
        });

        it("1.3 Should report vaults as approved", async function () {
            expect(await registry.isVaultApproved(HEXAONE_USDC_VAULT)).to.be.true;
            expect(await registry.isVaultApproved(CLEARSTAR_USDC_VAULT)).to.be.true;
            expect(await registry.isVaultApproved(ethers.ZeroAddress)).to.be.false;
        });

        it("1.4 Should return default vault for USDC", async function () {
            const defaultVault = await registry.getDefaultVault("USDC");
            expect(defaultVault).to.equal(HEXAONE_USDC_VAULT);
        });

        it("1.5 Should return no default vault for unconfigured token", async function () {
            const defaultVault = await registry.getDefaultVault("WBTC");
            expect(defaultVault).to.equal(ethers.ZeroAddress);
        });

        it("1.6 Should list registered vaults", async function () {
            const vaults = await registry.getRegisteredVaults();
            expect(vaults.length).to.equal(2);
            expect(vaults).to.include(HEXAONE_USDC_VAULT);
            expect(vaults).to.include(CLEARSTAR_USDC_VAULT);
        });

        it("1.7 Should return registered vault count", async function () {
            const count = await registry.getRegisteredVaultCount();
            expect(count).to.equal(2n);
        });

        it("1.8 Should allow deactivating a vault", async function () {
            await registry.setVaultStatus(CLEARSTAR_USDC_VAULT, false);
            expect(await registry.isVaultApproved(CLEARSTAR_USDC_VAULT)).to.be.false;

            // Re-activate
            await registry.setVaultStatus(CLEARSTAR_USDC_VAULT, true);
            expect(await registry.isVaultApproved(CLEARSTAR_USDC_VAULT)).to.be.true;
        });

        it("1.9 Should revert for unconfigured vault", async function () {
            const randomAddr = "0x0000000000000000000000000000000000000001";
            await expect(registry.getVaultConfig(randomAddr))
                .to.be.revertedWithCustomError(registry, "VaultNotConfigured");
        });

        it("1.10 Should prevent non-owner from configuring vaults", async function () {
            await expect(
                registry.connect(other).configureVault(ethers.ZeroAddress, "TEST")
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("1.11 Should allow changing default vault", async function () {
            await registry.setDefaultVault("USDC", CLEARSTAR_USDC_VAULT);
            expect(await registry.getDefaultVault("USDC")).to.equal(CLEARSTAR_USDC_VAULT);

            // Restore
            await registry.setDefaultVault("USDC", HEXAONE_USDC_VAULT);
            expect(await registry.getDefaultVault("USDC")).to.equal(HEXAONE_USDC_VAULT);
        });

        it("1.12 Should allow removing a vault", async function () {
            // Add a temp vault, then remove
            const tempVault = "0x0000000000000000000000000000000000000099";
            await registry.configureVault(tempVault, "TEST");
            expect(await registry.getRegisteredVaultCount()).to.equal(3n);

            await registry.removeVault(tempVault);
            expect(await registry.getRegisteredVaultCount()).to.equal(2n);
            expect(await registry.isVaultApproved(tempVault)).to.be.false;
        });
    });

    // ================================================================
    // 2. VAULT PLUGIN — BASIC STATE
    // ================================================================

    describe("2. MorphoVaultPlugin — Basic State", function () {
        it("2.1 Should have correct beacon", async function () {
            expect(await vaultPlugin.beacon()).to.equal(await mockBeacon.getAddress());
        });

        it("2.2 Should have correct owner", async function () {
            expect(await vaultPlugin.owner()).to.equal(owner.address);
        });

        it("2.3 Circuit breaker should be OFF", async function () {
            expect(await vaultPlugin.circuitBreakerTripped()).to.be.false;
        });

        it("2.4 Should have zero active vaults initially", async function () {
            expect(await vaultPlugin.getActiveVaultCount()).to.equal(0n);
        });

        it("2.5 Should have USDC balance from setup", async function () {
            const bal = await usdcContract.balanceOf(await vaultPlugin.getAddress());
            expect(bal).to.be.gte(ethers.parseUnits("1000", 6));
        });
    });

    // ================================================================
    // 3. VAULT DEPOSIT (via IProtocolAdapter — tokenCode routing)
    // ================================================================

    describe("3. IProtocolAdapter — deposit/withdraw routing", function () {
        it("3.1 Should deposit via IProtocolAdapter.deposit('USDC', amount)", async function () {
            // owner == ProtocolManager (mock)
            const tx = await vaultPlugin.deposit("USDC", DEPOSIT_AMOUNT);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            // Plugin should now hold shares in the vault
            const vault = new ethers.Contract(HEXAONE_USDC_VAULT, [
                "function balanceOf(address) view returns (uint256)",
                "function convertToAssets(uint256) view returns (uint256)",
            ], ethers.provider);

            const shares = await vault.balanceOf(await vaultPlugin.getAddress());
            expect(shares).to.be.gt(0n);
            console.log(`      Shares received: ${shares}`);

            const assetValue = await vault.convertToAssets(shares);
            console.log(`      Asset value: ${ethers.formatUnits(assetValue, 6)} USDC`);
            // Should be roughly 100 USDC (minus rounding)
            expect(assetValue).to.be.gte(ethers.parseUnits("99", 6));
        });

        it("3.2 Should report balance via IProtocolAdapter.getBalance('USDC')", async function () {
            const bal = await vaultPlugin.getBalance("USDC");
            expect(bal).to.be.gte(ethers.parseUnits("99", 6));
            console.log(`      Balance: ${ethers.formatUnits(bal, 6)} USDC`);
        });

        it("3.3 Should track as active vault", async function () {
            const count = await vaultPlugin.getActiveVaultCount();
            expect(count).to.equal(1n);
        });

        it("3.4 Should withdraw via IProtocolAdapter.withdraw('USDC', amount)", async function () {
            const proxyAddr = await mockProxyGeneral.getAddress();
            const proxyBalBefore = await usdcContract.balanceOf(proxyAddr);

            const tx = await vaultPlugin.withdraw("USDC", WITHDRAW_AMOUNT);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const proxyBalAfter = await usdcContract.balanceOf(proxyAddr);
            const received = proxyBalAfter - proxyBalBefore;
            console.log(`      ProxyGeneral received: ${ethers.formatUnits(received, 6)} USDC`);
            // Should receive ~50 USDC
            expect(received).to.be.gte(ethers.parseUnits("49", 6));
        });

        it("3.5 Should return 0 balance for non-configured token", async function () {
            const bal = await vaultPlugin.getBalance("WBTC");
            expect(bal).to.equal(0n);
        });

        it("3.6 Should revert deposit for token without default vault", async function () {
            await expect(vaultPlugin.deposit("WBTC", 1000))
                .to.be.revertedWithCustomError(vaultPlugin, "NoDefaultVault");
        });
    });

    // ================================================================
    // 4. VAULT-SPECIFIC OPERATIONS (granular control)
    // ================================================================

    describe("4. Vault-Specific Operations (vaultDeposit, vaultWithdraw, vaultRedeem)", function () {
        it("4.1 Should deposit into specific vault via vaultDeposit()", async function () {
            const tx = await vaultPlugin.vaultDeposit(HEXAONE_USDC_VAULT, SMALL_DEPOSIT);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("4.2 Should report vault shares via getVaultShares()", async function () {
            const shares = await vaultPlugin.getVaultShares(HEXAONE_USDC_VAULT);
            expect(shares).to.be.gt(0n);
            console.log(`      Shares: ${shares}`);
        });

        it("4.3 Should report vault balance via getVaultBalance()", async function () {
            const bal = await vaultPlugin.getVaultBalance(HEXAONE_USDC_VAULT);
            expect(bal).to.be.gt(0n);
            console.log(`      Balance: ${ethers.formatUnits(bal, 6)} USDC`);
        });

        it("4.4 Should withdraw specific amount via vaultWithdraw()", async function () {
            const proxyAddr = await mockProxyGeneral.getAddress();
            const proxyBalBefore = await usdcContract.balanceOf(proxyAddr);

            const tx = await vaultPlugin.vaultWithdraw(HEXAONE_USDC_VAULT, SMALL_DEPOSIT);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const proxyBalAfter = await usdcContract.balanceOf(proxyAddr);
            const received = proxyBalAfter - proxyBalBefore;
            console.log(`      ProxyGeneral received: ${ethers.formatUnits(received, 6)} USDC`);
            expect(received).to.be.gte(ethers.parseUnits("9", 6));
        });

        it("4.5 Should deposit into second vault (Clearstar)", async function () {
            const tx = await vaultPlugin.vaultDeposit(CLEARSTAR_USDC_VAULT, SMALL_DEPOSIT);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const count = await vaultPlugin.getActiveVaultCount();
            expect(count).to.equal(2n);
            console.log(`      Active vaults: ${count}`);
        });

        it("4.6 Should list all vault positions via getAllVaultPositions()", async function () {
            const [vaults, balances] = await vaultPlugin.getAllVaultPositions();
            expect(vaults.length).to.equal(2);

            for (let i = 0; i < vaults.length; i++) {
                console.log(`      Vault ${i}: ${vaults[i]} → ${ethers.formatUnits(balances[i], 6)} USDC`);
            }
        });

        it("4.7 Should report total vault value", async function () {
            const total = await vaultPlugin.getTotalVaultValue();
            expect(total).to.be.gt(0n);
            console.log(`      Total vault value: ${ethers.formatUnits(total, 6)} USDC`);
        });

        it("4.8 Should redeem all shares from a vault via vaultRedeem()", async function () {
            const sharesBefore = await vaultPlugin.getVaultShares(CLEARSTAR_USDC_VAULT);
            expect(sharesBefore).to.be.gt(0n);

            const proxyAddr = await mockProxyGeneral.getAddress();
            const proxyBalBefore = await usdcContract.balanceOf(proxyAddr);

            // Redeem all (shares=0 means all)
            const tx = await vaultPlugin.vaultRedeem(CLEARSTAR_USDC_VAULT, 0);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const sharesAfter = await vaultPlugin.getVaultShares(CLEARSTAR_USDC_VAULT);
            expect(sharesAfter).to.equal(0n);

            const proxyBalAfter = await usdcContract.balanceOf(proxyAddr);
            const received = proxyBalAfter - proxyBalBefore;
            console.log(`      Redeemed: ${ethers.formatUnits(received, 6)} USDC from Clearstar`);
            expect(received).to.be.gt(0n);

            // Vault should be removed from active list
            const count = await vaultPlugin.getActiveVaultCount();
            expect(count).to.equal(1n);
        });

        it("4.9 Should revert deposit to unapproved vault", async function () {
            // Use MEV Capital vault which is NOT configured in our registry
            const unapprovedVault = "0xa60643c90A542A95026C0F1dbdB0615fF42019Cf";
            await expect(vaultPlugin.vaultDeposit(unapprovedVault, SMALL_DEPOSIT))
                .to.be.revertedWithCustomError(vaultPlugin, "VaultNotApproved");
        });
    });

    // ================================================================
    // 5. CLOSE POSITION / EMERGENCY WITHDRAW
    // ================================================================

    describe("5. Close Position & Emergency Withdraw", function () {
        before(async function () {
            // Ensure we have a position to close
            const bal = await vaultPlugin.getVaultBalance(HEXAONE_USDC_VAULT);
            if (bal === 0n) {
                await vaultPlugin.deposit("USDC", DEPOSIT_AMOUNT);
            }
        });

        it("5.1 Should closePosition (redeem all vaults)", async function () {
            const sharesBefore = await vaultPlugin.getVaultShares(HEXAONE_USDC_VAULT);
            expect(sharesBefore).to.be.gt(0n);

            const tx = await vaultPlugin.closePosition(0);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("5.2 Should emergencyWithdrawAll", async function () {
            // Re-deposit first
            await vaultPlugin.deposit("USDC", DEPOSIT_AMOUNT);
            const shares = await vaultPlugin.getVaultShares(HEXAONE_USDC_VAULT);
            expect(shares).to.be.gt(0n);

            const tx = await vaultPlugin.emergencyWithdrawAll([]);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });
    });

    // ================================================================
    // 6. CIRCUIT BREAKER
    // ================================================================

    describe("6. Circuit Breaker", function () {
        it("6.1 Should activate circuit breaker", async function () {
            await vaultPlugin.activateCircuitBreaker();
            expect(await vaultPlugin.circuitBreakerTripped()).to.be.true;
        });

        it("6.2 Should block deposits when circuit breaker is active", async function () {
            await expect(vaultPlugin.deposit("USDC", SMALL_DEPOSIT))
                .to.be.revertedWithCustomError(vaultPlugin, "CircuitBreakerActive");
        });

        it("6.3 Should block withdrawals when circuit breaker is active", async function () {
            await expect(vaultPlugin.withdraw("USDC", SMALL_DEPOSIT))
                .to.be.revertedWithCustomError(vaultPlugin, "CircuitBreakerActive");
        });

        it("6.4 Should block vaultDeposit when circuit breaker is active", async function () {
            await expect(vaultPlugin.vaultDeposit(HEXAONE_USDC_VAULT, SMALL_DEPOSIT))
                .to.be.revertedWithCustomError(vaultPlugin, "CircuitBreakerActive");
        });

        it("6.5 Should deactivate circuit breaker", async function () {
            await vaultPlugin.deactivateCircuitBreaker();
            expect(await vaultPlugin.circuitBreakerTripped()).to.be.false;
        });
    });

    // ================================================================
    // 7. ACCESS CONTROL
    // ================================================================

    describe("7. Access Control", function () {
        it("7.1 Should prevent non-ProtocolManager from deposit", async function () {
            await expect(vaultPlugin.connect(other).deposit("USDC", SMALL_DEPOSIT))
                .to.be.revertedWithCustomError(vaultPlugin, "OnlyProtocolManager");
        });

        it("7.2 Should prevent non-ProtocolManager from withdraw", async function () {
            await expect(vaultPlugin.connect(other).withdraw("USDC", SMALL_DEPOSIT))
                .to.be.revertedWithCustomError(vaultPlugin, "OnlyProtocolManager");
        });

        it("7.3 Should prevent non-ProtocolManager from vaultDeposit", async function () {
            await expect(vaultPlugin.connect(other).vaultDeposit(HEXAONE_USDC_VAULT, SMALL_DEPOSIT))
                .to.be.revertedWithCustomError(vaultPlugin, "OnlyProtocolManager");
        });

        it("7.4 Should prevent non-owner from activateCircuitBreaker", async function () {
            await expect(vaultPlugin.connect(other).activateCircuitBreaker())
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("7.5 Should prevent non-owner from emergencyWithdrawAll", async function () {
            await expect(vaultPlugin.connect(other).emergencyWithdrawAll([]))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 8. LENS ADAPTER
    // ================================================================

    describe("8. MorphoVaultLensAdapter — Monitoring", function () {
        before(async function () {
            // Ensure plugin has USDC and an active position
            const pluginAddr = await vaultPlugin.getAddress();
            const pluginBal = await usdcContract.balanceOf(pluginAddr);
            if (pluginBal < DEPOSIT_AMOUNT) {
                await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
                const whale = await ethers.getSigner(USDC_WHALE);
                await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
                await usdcContract.connect(whale).transfer(pluginAddr, ethers.parseUnits("500", 6));
                await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
            }
            const bal = await vaultPlugin.getVaultBalance(HEXAONE_USDC_VAULT);
            if (bal === 0n) {
                await vaultPlugin.deposit("USDC", DEPOSIT_AMOUNT);
            }
        });

        it("8.1 Should return protocol name", async function () {
            expect(await vaultLensAdapter.protocolName()).to.equal("MorphoVault");
        });

        it("8.2 Should return YIELD protocol type", async function () {
            const pType = await vaultLensAdapter.protocolType();
            expect(pType).to.equal(1n); // ProtocolType.YIELD = 1 (0=LENDING, 1=YIELD, 2=TRADING, 3=LIQUIDITY)
        });

        it("8.3 Should return circuit breaker status", async function () {
            expect(await vaultLensAdapter.isCircuitBreakerActive()).to.be.false;
        });

        it("8.4 Should return plugin address", async function () {
            const pluginAddr = await vaultLensAdapter.getPlugin();
            expect(pluginAddr).to.equal(await vaultPlugin.getAddress());
        });

        it("8.5 Should return positive total value in ETH", async function () {
            const totalValue = await vaultLensAdapter.getTotalValue();
            console.log(`      Total value: ${ethers.formatEther(totalValue)} ETH`);
            // 100 USDC ≈ 0.04 ETH at $2500/ETH
            expect(totalValue).to.be.gt(0n);
        });

        it("8.6 Should return value breakdown", async function () {
            const breakdown = await vaultLensAdapter.getValueBreakdown();
            console.log(`      Collateral: ${ethers.formatEther(breakdown.totalCollateral)} ETH`);
            console.log(`      Debt: ${ethers.formatEther(breakdown.totalDebt)} ETH`);
            console.log(`      Net: ${ethers.formatEther(breakdown.netValue)} ETH`);
            
            expect(breakdown.totalDebt).to.equal(0n);
            expect(breakdown.netValue).to.equal(breakdown.totalCollateral);
            expect(breakdown.netValue).to.be.gt(0n);
        });

        it("8.7 Should return infinite health factor (supply-only)", async function () {
            const hf = await vaultLensAdapter.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
        });

        it("8.8 Should return healthy account", async function () {
            const health = await vaultLensAdapter.getAccountHealth();
            expect(health.isHealthy).to.be.true;
            expect(health.riskLevel).to.equal("SAFE");
            expect(health.healthFactor).to.equal(ethers.MaxUint256);
        });

        it("8.9 Should return active position count", async function () {
            const count = await vaultLensAdapter.getActivePositionCount();
            expect(count).to.be.gte(1n);
            console.log(`      Active positions: ${count}`);
        });

        it("8.10 Should return protocol summary", async function () {
            const summary = await vaultLensAdapter.getProtocolSummary();
            expect(summary.name).to.equal("MorphoVault");
            expect(summary.isHealthy).to.be.true;
            expect(summary.netValue).to.be.gt(0n);
            expect(summary.totalDebt).to.equal(0n);
            expect(summary.lowestHealthFactor).to.equal(ethers.MaxUint256);
            console.log(`      Summary: ${summary.name}, net=${ethers.formatEther(summary.netValue)} ETH, positions=${summary.activePositionCount}`);
        });

        it("8.11 Should return empty positions at risk", async function () {
            const atRisk = await vaultLensAdapter.getPositionsAtRisk(ethers.parseEther("1.5"));
            expect(atRisk.length).to.equal(0);
        });

        it("8.12 Should return positions sorted by risk (all SAFE)", async function () {
            const positions = await vaultLensAdapter.getPositionsSortedByRisk();
            expect(positions.length).to.be.gte(1);
            for (const pos of positions) {
                expect(pos.riskLevel).to.equal("SAFE");
                expect(pos.healthFactor).to.equal(ethers.MaxUint256);
                expect(pos.shouldAutoClose).to.be.false;
            }
        });

        it("8.13 Should return vault for token from Registry", async function () {
            const vaultAddr = await vaultLensAdapter.getVaultForToken("USDC");
            expect(vaultAddr).to.equal(HEXAONE_USDC_VAULT);
        });

        it("8.14 Should estimate WETH from close all", async function () {
            const estimate = await vaultLensAdapter.estimateBaseAssetFromCloseAll();
            expect(estimate).to.be.gt(0n);
            console.log(`      Estimated WETH from close all: ${ethers.formatEther(estimate)} ETH`);
        });

        it("8.15 Should return protocol limits (no liquidation)", async function () {
            const limits = await vaultLensAdapter.getProtocolLimits();
            expect(limits.minHealthFactor).to.equal(ethers.MaxUint256);
            expect(limits.maxLeverage).to.equal(100n); // 1x only
        });
    });

    // ================================================================
    // 9. INTEGRATION — FULL FLOW
    // ================================================================

    describe("9. Integration — Full Deposit→Monitor→Withdraw Flow", function () {
        it("9.1 Complete lifecycle", async function () {
            // Ensure plugin has USDC
            const pluginBal = await usdcContract.balanceOf(await vaultPlugin.getAddress());
            if (pluginBal < DEPOSIT_AMOUNT) {
                // Re-fund
                await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
                const whale = await ethers.getSigner(USDC_WHALE);
                await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
                await usdcContract.connect(whale).transfer(await vaultPlugin.getAddress(), ethers.parseUnits("500", 6));
                await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
            }

            console.log("\n      📥 Step 1: Deposit 100 USDC into default vault...");
            await vaultPlugin.deposit("USDC", DEPOSIT_AMOUNT);
            const balAfterDeposit = await vaultPlugin.getBalance("USDC");
            console.log(`      Balance after deposit: ${ethers.formatUnits(balAfterDeposit, 6)} USDC`);
            expect(balAfterDeposit).to.be.gte(ethers.parseUnits("99", 6));

            console.log("\n      📊 Step 2: Check monitoring...");
            const value = await vaultLensAdapter.getTotalValue();
            const hf = await vaultLensAdapter.getHealthFactor();
            const summary = await vaultLensAdapter.getProtocolSummary();
            console.log(`      Total ETH value: ${ethers.formatEther(value)}`);
            console.log(`      Health factor: ${hf === ethers.MaxUint256 ? "∞ (infinite)" : hf.toString()}`);
            console.log(`      Active positions: ${summary.activePositionCount}`);
            expect(value).to.be.gt(0n);
            expect(hf).to.equal(ethers.MaxUint256);

            console.log("\n      📤 Step 3: Withdraw 50 USDC...");
            const proxyAddr = await mockProxyGeneral.getAddress();
            const proxyBefore = await usdcContract.balanceOf(proxyAddr);
            await vaultPlugin.withdraw("USDC", WITHDRAW_AMOUNT);
            const proxyAfter = await usdcContract.balanceOf(proxyAddr);
            const withdrawn = proxyAfter - proxyBefore;
            console.log(`      Withdrawn to ProxyGeneral: ${ethers.formatUnits(withdrawn, 6)} USDC`);
            expect(withdrawn).to.be.gte(ethers.parseUnits("49", 6));

            console.log("\n      📊 Step 4: Re-check monitoring after partial withdraw...");
            const valueAfter = await vaultLensAdapter.getTotalValue();
            console.log(`      Total ETH value after withdraw: ${ethers.formatEther(valueAfter)}`);
            expect(valueAfter).to.be.lt(value); // Should be less after withdraw

            console.log("\n      ✅ Full lifecycle completed successfully!");
        });
    });
});
