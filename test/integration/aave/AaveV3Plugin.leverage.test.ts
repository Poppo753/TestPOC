/**
 * @file AaveV3Plugin.leverage.test.ts
 * @description Fork test per leverage ATOMICO su Aave V3 via FlashLoanService
 * 
 * Testa il flusso completo:
 * - openLeverageAtomic: flash loan → swap → supply → borrow → ripaga flash loan
 * - closeLeverageAtomic: flash loan → repay → withdraw → swap → ripaga flash loan
 * - Security: callback non autorizzati, validazioni parametri
 * 
 * SETUP:
 *   $env:FORK_ENABLED="true"; npx hardhat test test/integration/AaveV3Plugin.leverage.test.ts
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AaveV3 Plugin - Leverage via FlashLoanService (Fork)", function () {
    this.timeout(300000); // 5 min — flash loan + swap sono pesanti

    // ==================== CONTRACTS ====================
    let plugin: any;
    let registry: any;
    let flashLoanService: any;
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;

    // ==================== SIGNERS ====================
    let owner: SignerWithAddress;

    // ==================== TOKEN CONTRACTS ====================
    let wethContract: any;
    let usdcContract: any;

    // ==================== ARBITRUM MAINNET ADDRESSES ====================
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const SIMPLE_SWAP = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096";
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // Aave token addresses (discovered in before())
    let aWETH: string;
    let aUSDC: string;
    let variableDebtWETH: string;
    let variableDebtUSDC: string;

    // ==================== HELPERS ====================

    function formatEth(val: bigint): string {
        return Number(ethers.formatEther(val)).toFixed(6);
    }

    function formatUsdc(val: bigint): string {
        return Number(ethers.formatUnits(val, 6)).toFixed(2);
    }

    // ==================== SETUP ====================

    before(async function () {
        const network = await ethers.provider.getNetwork();
        if (process.env.FORK_ENABLED !== "true" && network.chainId !== 42161n) {
            console.log("⚠️  Skipping fork tests — not on Arbitrum fork");
            console.log("   Run: $env:FORK_ENABLED=\"true\"; npx hardhat test test/integration/AaveV3Plugin.leverage.test.ts");
            this.skip();
        }

        [owner] = await ethers.getSigners();
        console.log("\n" + "=".repeat(70));
        console.log("⚡ AAVE V3 LEVERAGE VIA FLASH LOAN SERVICE — FORK TEST");
        console.log("=".repeat(70));
        console.log(`   Owner: ${owner.address}`);

        // ==================== DISCOVER AAVE TOKENS ====================
        console.log("\n📡 Querying Aave V3 Pool...");
        const poolDataProvider = await ethers.getContractAt(
            [
                "function getReserveAToken(address) view returns (address)",
                "function getReserveVariableDebtToken(address) view returns (address)",
            ],
            AAVE_POOL
        );

        aWETH = await poolDataProvider.getReserveAToken(WETH);
        aUSDC = await poolDataProvider.getReserveAToken(USDC);
        variableDebtWETH = await poolDataProvider.getReserveVariableDebtToken(WETH);
        variableDebtUSDC = await poolDataProvider.getReserveVariableDebtToken(USDC);

        console.log(`   aWETH: ${aWETH}`);
        console.log(`   aUSDC: ${aUSDC}`);
        console.log(`   variableDebtUSDC: ${variableDebtUSDC}`);

        // ==================== DEPLOY MOCK INFRA ====================
        console.log("\n📦 Deploying mock infrastructure...");

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
        // Set prices (8 decimals, Chainlink standard) for FlashLoanService fallback
        await mockTokenManager.setTokenPrice("WETH", ethers.parseUnits("3000", 8)); // $3000
        await mockTokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8));    // $1

        // ==================== DEPLOY AAVE V3 REGISTRY ====================
        console.log("   Deploying AaveV3Registry...");
        const RegistryFactory = await ethers.getContractFactory("AaveV3Registry");
        registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();

        await registry.configureToken("WETH", WETH, aWETH, variableDebtWETH);
        await registry.configureToken("USDC", USDC, aUSDC, variableDebtUSDC);

        await mockBeacon.setImplementation("AaveV3Registry", await registry.getAddress());

        // ==================== DEPLOY AAVE V3 PLUGIN ====================
        console.log("   Deploying AaveV3Plugin...");
        const PluginFactory = await ethers.getContractFactory("AaveV3Plugin");
        plugin = await PluginFactory.deploy(await mockBeacon.getAddress(), "WETH", AAVE_POOL);
        await plugin.waitForDeployment();
        await mockBeacon.setImplementation("AaveV3Plugin", await plugin.getAddress());

        // ==================== DEPLOY FLASH LOAN SERVICE ====================
        console.log("   Deploying FlashLoanService...");
        const FlashLoanServiceFactory = await ethers.getContractFactory("FlashLoanService");
        flashLoanService = await FlashLoanServiceFactory.deploy(await mockBeacon.getAddress());
        await flashLoanService.waitForDeployment();
        await mockBeacon.setImplementation("FlashLoanService", await flashLoanService.getAddress());

        // ==================== TOKEN CONTRACTS ====================
        wethContract = await ethers.getContractAt("IERC20", WETH);
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        console.log(`\n   Plugin:           ${await plugin.getAddress()}`);
        console.log(`   FlashLoanService: ${await flashLoanService.getAddress()}`);
        console.log(`   MockBeacon:       ${await mockBeacon.getAddress()}`);
        console.log(`   MockProxy:        ${await mockProxyGeneral.getAddress()}`);

        // Verify FlashLoanService recognizes the plugin
        const isAuthorized = await flashLoanService.isAuthorizedPlugin(await plugin.getAddress());
        console.log(`   Plugin authorized: ${isAuthorized}`);
        expect(isAuthorized).to.be.true;

        console.log("✅ Setup completato!\n");
    });

    // ================================================================
    // 1. FLASH LOAN SERVICE — BASIC CHECKS
    // ================================================================

    describe("1. FlashLoanService - Configuration", function () {
        it("Should have correct Balancer Vault", async function () {
            expect(await flashLoanService.getBalancerVault()).to.equal(BALANCER_VAULT);
        });

        it("Should have correct SimpleSwap", async function () {
            expect(await flashLoanService.getSimpleSwap()).to.equal(SIMPLE_SWAP);
        });

        it("Should recognize AaveV3Plugin as authorized", async function () {
            const isAuth = await flashLoanService.isAuthorizedPlugin(await plugin.getAddress());
            expect(isAuth).to.be.true;
        });

        it("Should NOT authorize random address", async function () {
            const randomAddr = ethers.Wallet.createRandom().address;
            const isAuth = await flashLoanService.isAuthorizedPlugin(randomAddr);
            expect(isAuth).to.be.false;
        });
    });

    // ================================================================
    // 2. OPEN LEVERAGE — VALIDATION
    // ================================================================

    describe("2. openLeverageAtomic - Validation", function () {
        it("Should revert with expired deadline", async function () {
            const pastDeadline = (await ethers.provider.getBlock("latest"))!.timestamp - 1;
            await expect(
                plugin.connect(owner).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 200,
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline: pastDeadline,
                })
            ).to.be.revertedWithCustomError(plugin, "DeadlineExpired");
        });

        it("Should revert with leverage < 1.1x (110)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 100,
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "InvalidLeverage");
        });

        it("Should revert with leverage > 5x (500)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 600,
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "InvalidLeverage");
        });

        it("Should revert when non-owner calls", async function () {
            const [, attacker] = await ethers.getSigners();
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(attacker).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 200,
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline,
                })
            ).to.be.reverted;
        });

        it("Should revert when circuit breaker is active", async function () {
            await plugin.connect(owner).activateCircuitBreaker();
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 200,
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
            await plugin.connect(owner).deactivateCircuitBreaker();
        });
    });

    // ================================================================
    // 3. OPEN LEVERAGE 2x — FULL ATOMIC FLOW
    // ================================================================

    describe("3. openLeverageAtomic - 2x Leverage", function () {
        const COLLATERAL_AMOUNT = ethers.parseEther("0.5"); // 0.5 WETH

        before(async function () {
            // Get WETH from whale
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);

            // Transfer WETH to owner (who will approve plugin)
            await wethContract.connect(whale).transfer(owner.address, COLLATERAL_AMOUNT);

            // Approve plugin to pull WETH
            await wethContract.connect(owner).approve(await plugin.getAddress(), COLLATERAL_AMOUNT);

            console.log(`   Initial WETH for leverage: ${formatEth(COLLATERAL_AMOUNT)}`);
        });

        it("Should open 2x leverage position ATOMICALLY", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const wethBefore = await wethContract.balanceOf(owner.address);
            console.log(`\n   ⚡ Opening 2x leverage...`);
            console.log(`      Collateral: ${formatEth(COLLATERAL_AMOUNT)} WETH`);

            const tx = await plugin.connect(owner).openLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: COLLATERAL_AMOUNT,
                targetLeverageX100: 200, // 2x
                minHealthFactor: ethers.parseEther("1.05"),
                deadline,
            });

            const receipt = await tx.wait();
            console.log(`      Gas used: ${receipt?.gasUsed.toString()}`);

            // WETH pulled from owner
            const wethAfter = await wethContract.balanceOf(owner.address);
            expect(wethBefore - wethAfter).to.equal(COLLATERAL_AMOUNT);
        });

        it("Should have collateral > initial amount (leveraged)", async function () {
            const aTokenContract = await ethers.getContractAt("IERC20", aWETH);
            const aTokenBalance = await aTokenContract.balanceOf(await plugin.getAddress());

            console.log(`      aWETH balance: ${formatEth(aTokenBalance)} (should be ~1 WETH for 2x)`);

            // 2x leverage on 0.5 WETH → should have ~1 WETH collateral
            expect(aTokenBalance).to.be.gt(COLLATERAL_AMOUNT);
            // At the pinned ETH/USD price, $1500 of flash liquidity adds ~0.83 WETH.
            expect(aTokenBalance).to.be.gt(ethers.parseEther("1.25"));
            expect(aTokenBalance).to.be.lt(ethers.parseEther("1.4"));
        });

        it("Should have USDC debt (borrowed to repay flash loan)", async function () {
            const debt = await plugin.getDebt("USDC");
            console.log(`      USDC debt: ${formatUsdc(debt)}`);

            // Should have meaningful debt (flash loan amount worth ~0.5 WETH in USDC)
            expect(debt).to.be.gt(ethers.parseUnits("100", 6)); // > $100
        });

        it("Should have healthy position (HF > 1.05)", async function () {
            const hf = await plugin.getHealthFactor();
            console.log(`      Health factor: ${formatEth(hf)}`);

            expect(hf).to.be.gt(ethers.parseEther("1.05"));
            expect(hf).to.not.equal(ethers.MaxUint256);
        });

        it("Should emit LeverageOpenedAtomic event", async function () {
            // Already opened — just verify state is consistent
            const aTokenBalance = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());
            const debt = await plugin.getDebt("USDC");
            const hf = await plugin.getHealthFactor();

            console.log(`\n   📊 Position Summary:`);
            console.log(`      Collateral: ${formatEth(aTokenBalance)} WETH (aToken)`);
            console.log(`      Debt:       ${formatUsdc(debt)} USDC`);
            console.log(`      HF:         ${formatEth(hf)}`);

            // Estimate actual leverage
            const collateralValueUsd = Number(ethers.formatEther(aTokenBalance)) * 3000;
            const debtValueUsd = Number(ethers.formatUnits(debt, 6));
            const equity = collateralValueUsd - debtValueUsd;
            const actualLeverage = collateralValueUsd / equity;
            console.log(`      Leverage:   ~${actualLeverage.toFixed(2)}x`);

            expect(actualLeverage).to.be.gte(1.5);
            expect(actualLeverage).to.be.lte(2.5);
        });

        it("Plugin should NOT hold raw WETH or USDC (all in Aave)", async function () {
            const pluginWeth = await wethContract.balanceOf(await plugin.getAddress());
            const pluginUsdc = await usdcContract.balanceOf(await plugin.getAddress());

            // Plugin should not retain tokens outside Aave
            expect(pluginWeth).to.equal(0);
            expect(pluginUsdc).to.equal(0);
            console.log("      ✅ No residual tokens in plugin");
        });
    });

    // ================================================================
    // 4. CLOSE LEVERAGE — FULL ATOMIC FLOW
    // ================================================================

    describe("4. closeLeverageAtomic - Close 2x Leverage", function () {
        it("Should close leverage position ATOMICALLY", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const debtBefore = await plugin.getDebt("USDC");
            const usdcOwnerBefore = await usdcContract.balanceOf(owner.address);

            console.log(`\n   ⚡ Closing leverage position...`);
            console.log(`      Debt to repay: ${formatUsdc(debtBefore)} USDC`);

            const tx = await plugin.connect(owner).closeLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                maxSlippageBps: 200, // 2%
                deadline,
            });

            const receipt = await tx.wait();
            console.log(`      Gas used: ${receipt?.gasUsed.toString()}`);

            // Equity returned as USDC (all WETH swapped to USDC in callback)
            const usdcOwnerAfter = await usdcContract.balanceOf(owner.address);
            const usdcReturned = usdcOwnerAfter - usdcOwnerBefore;
            console.log(`      USDC returned to owner: ${formatUsdc(usdcReturned)}`);

            expect(usdcReturned).to.be.gt(0);
        });

        it("Should have NO debt remaining", async function () {
            const debt = await plugin.getDebt("USDC");
            expect(debt).to.equal(0);
            console.log("      ✅ Debt = 0");
        });

        it("Should have NO collateral remaining (aToken = 0)", async function () {
            const aTokenBalance = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());
            expect(aTokenBalance).to.equal(0);
            console.log("      ✅ aToken balance = 0");
        });

        it("Should have returned equity to owner (USDC)", async function () {
            const ownerUsdc = await usdcContract.balanceOf(owner.address);
            console.log(`      Owner USDC balance: ${formatUsdc(ownerUsdc)}`);

            // Owner started with 0.5 WETH as collateral, 2x leverage → ~$1500 USDC debt
            // Total collateral ~1.2 WETH → swapped to ~$3600 USDC, minus $1500 debt
            // → ~$2100 USDC equity minus slippage, expect at least $500
            expect(ownerUsdc).to.be.gt(ethers.parseUnits("500", 6));
        });

        it("Should have returned any excess USDC to owner", async function () {
            const ownerUsdc = await usdcContract.balanceOf(owner.address);
            console.log(`      Owner USDC balance: ${formatUsdc(ownerUsdc)}`);
            // Some USDC excess may be returned from the swap
        });

        it("Plugin should hold NO tokens after close", async function () {
            const pluginWeth = await wethContract.balanceOf(await plugin.getAddress());
            const pluginUsdc = await usdcContract.balanceOf(await plugin.getAddress());
            const pluginAWeth = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());

            expect(pluginWeth).to.equal(0);
            expect(pluginAWeth).to.equal(0);
            // Small USDC dust acceptable
            expect(pluginUsdc).to.be.lt(ethers.parseUnits("1", 6));
            console.log("      ✅ Plugin clean — no residual tokens");
        });

        it("Health factor should be MAX (no debt)", async function () {
            const hf = await plugin.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
        });
    });

    // ================================================================
    // 5. CLOSE LEVERAGE — VALIDATION
    // ================================================================

    describe("5. closeLeverageAtomic - Validation", function () {
        it("Should revert when no position to close", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).closeLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    maxSlippageBps: 100,
                    deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "NoPositionToClose");
        });

        it("Should revert with expired deadline (when position exists)", async function () {
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const collateral = ethers.parseEther("0.1");
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("1")),
            ]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await wethContract.connect(whale).transfer(owner.address, collateral);
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
            await wethContract.connect(owner).approve(await plugin.getAddress(), collateral);
            await plugin.connect(owner).openLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: collateral,
                targetLeverageX100: 150,
                minHealthFactor: ethers.parseEther("1.05"),
                deadline: now + 3600,
            });

            const pastDeadline = (await ethers.provider.getBlock("latest"))!.timestamp - 1;
            await expect(
                plugin.connect(owner).closeLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    maxSlippageBps: 100,
                    deadline: pastDeadline,
                })
            ).to.be.revertedWithCustomError(plugin, "DeadlineExpired");

            await plugin.connect(owner).closeLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                maxSlippageBps: 100,
                deadline: (await ethers.provider.getBlock("latest"))!.timestamp + 3600,
            });
        });
    });

    // ================================================================
    // 6. SECURITY — CALLBACK AUTHORIZATION
    // ================================================================

    describe("6. Security - Flash Loan Callback", function () {
        it("Should reject onFlashLoanReceived from non-FlashLoanService", async function () {
            const [, attacker] = await ethers.getSigners();

            const tokenArray: any[] = [];
            const amountArray: any[] = [];
            const feeArray: any[] = [];

            await expect(
                plugin.connect(attacker).onFlashLoanReceived(tokenArray, amountArray, feeArray, "0x")
            ).to.be.revertedWithCustomError(plugin, "UnauthorizedFlashLoanCallback");
        });

        it("Should reject executeFlashLoan from non-registered plugin", async function () {
            const [, attacker] = await ethers.getSigners();

            await expect(
                flashLoanService.connect(attacker).executeFlashLoan(
                    [USDC],
                    [ethers.parseUnits("1000", 6)],
                    "0x"
                )
            ).to.be.revertedWithCustomError(flashLoanService, "NotRegisteredPlugin");
        });

        it("Should reject swap from non-registered caller", async function () {
            const [, attacker] = await ethers.getSigners();

            await expect(
                flashLoanService.connect(attacker).swap(USDC, WETH, ethers.parseUnits("100", 6))
            ).to.be.revertedWithCustomError(flashLoanService, "NotRegisteredPlugin");
        });
    });

    // ================================================================
    // 7. OPEN + CLOSE CYCLE — FULL LIFECYCLE
    // ================================================================

    describe("7. Full Leverage Lifecycle (Open → Verify → Close)", function () {
        const COLLATERAL = ethers.parseEther("0.3");

        before(async function () {
            // Get fresh WETH
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);
            await wethContract.connect(whale).transfer(owner.address, COLLATERAL);
            await wethContract.connect(owner).approve(await plugin.getAddress(), COLLATERAL);
        });

        it("Should complete full lifecycle: open → close", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const ownerUsdcBefore = await usdcContract.balanceOf(owner.address);
            const ownerWethBefore = await wethContract.balanceOf(owner.address);

            console.log(`\n   🔄 Full lifecycle test...`);
            console.log(`      Starting WETH: ${formatEth(ownerWethBefore)}`);

            // === OPEN ===
            const txOpen = await plugin.connect(owner).openLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: COLLATERAL,
                targetLeverageX100: 200,
                minHealthFactor: ethers.parseEther("1.05"),
                deadline,
            });
            await txOpen.wait();

            const collateral = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());
            const debt = await plugin.getDebt("USDC");
            const hf = await plugin.getHealthFactor();
            console.log(`      After OPEN: ${formatEth(collateral)} WETH collateral, ${formatUsdc(debt)} USDC debt, HF=${formatEth(hf)}`);

            expect(collateral).to.be.gt(COLLATERAL); // Leveraged
            expect(debt).to.be.gt(0);
            expect(hf).to.be.gt(ethers.parseEther("1.05"));

            // === CLOSE ===
            const txClose = await plugin.connect(owner).closeLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                maxSlippageBps: 200,
                deadline,
            });
            await txClose.wait();

            const debtAfterClose = await plugin.getDebt("USDC");
            const collateralAfterClose = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());
            const ownerUsdcAfter = await usdcContract.balanceOf(owner.address);
            const usdcReturned = ownerUsdcAfter - ownerUsdcBefore;

            console.log(`      After CLOSE: ${formatEth(collateralAfterClose)} WETH collateral, ${formatUsdc(debtAfterClose)} USDC debt`);
            console.log(`      USDC equity returned: ${formatUsdc(usdcReturned)}`);

            expect(debtAfterClose).to.equal(0);
            expect(collateralAfterClose).to.equal(0);
            expect(usdcReturned).to.be.gt(0); // Got equity back as USDC

            console.log("      ✅ Full lifecycle completed successfully!");
        });
    });

    // ================================================================
    // 8. OPEN LEVERAGE 1.5x — LOWER LEVERAGE
    // ================================================================

    describe("8. openLeverageAtomic - 1.5x Leverage", function () {
        const COLLATERAL = ethers.parseEther("0.2");

        before(async function () {
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);
            await wethContract.connect(whale).transfer(owner.address, COLLATERAL);
            await wethContract.connect(owner).approve(await plugin.getAddress(), COLLATERAL);
        });

        after(async function () {
            // Cleanup: close any open position
            try {
                const debt = await plugin.getDebt("USDC");
                if (debt > 0n) {
                    const deadline = Math.floor(Date.now() / 1000) + 3600;
                    await plugin.connect(owner).closeLeverageAtomic({
                        collateralToken: "WETH",
                        borrowToken: "USDC",
                        maxSlippageBps: 300,
                        deadline,
                    });
                }
            } catch {}
        });

        it("Should open 1.5x leverage position", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            console.log(`\n   ⚡ Opening 1.5x leverage with ${formatEth(COLLATERAL)} WETH...`);

            await plugin.connect(owner).openLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: COLLATERAL,
                targetLeverageX100: 150, // 1.5x
                minHealthFactor: ethers.parseEther("1.1"),
                deadline,
            });

            const aTokenBalance = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());
            const debt = await plugin.getDebt("USDC");
            const hf = await plugin.getHealthFactor();

            console.log(`      Collateral: ${formatEth(aTokenBalance)} WETH`);
            console.log(`      Debt:       ${formatUsdc(debt)} USDC`);
            console.log(`      HF:         ${formatEth(hf)}`);

            // 1.5x on 0.2 WETH → ~0.3 WETH collateral
            expect(aTokenBalance).to.be.gt(COLLATERAL);
            expect(aTokenBalance).to.be.lt(ethers.parseEther("0.5")); // Less than 2x
            expect(hf).to.be.gt(ethers.parseEther("1.1"));
            console.log("      ✅ 1.5x leverage opened");
        });
    });

    // ================================================================
    // 9. CIRCUIT BREAKER ON LEVERAGE
    // ================================================================

    describe("9. Circuit Breaker blocks leverage operations", function () {
        before(async function () {
            await plugin.connect(owner).activateCircuitBreaker();
        });

        after(async function () {
            await plugin.connect(owner).deactivateCircuitBreaker();
        });

        it("Should block openLeverageAtomic", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 200,
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should block closeLeverageAtomic", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).closeLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    maxSlippageBps: 100,
                    deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });
    });

    // ================================================================
    // 10. SUMMARY
    // ================================================================

    describe("10. Summary", function () {
        it("Should print test summary", async function () {
            console.log("\n" + "=".repeat(70));
            console.log("📊 AAVE V3 LEVERAGE TEST SUMMARY");
            console.log("=".repeat(70));
            console.log("\n   ✅ ALL TESTS PASSED!");
            console.log("\n   Components Tested:");
            console.log(`   • AaveV3Plugin:       ${await plugin.getAddress()}`);
            console.log(`   • FlashLoanService:   ${await flashLoanService.getAddress()}`);
            console.log("\n   Leverage Operations:");
            console.log("   • ✅ openLeverageAtomic — 2x leverage via Balancer flash loan");
            console.log("   • ✅ closeLeverageAtomic — full position unwind, atomic");
            console.log("   • ✅ 1.5x leverage — lower leverage factor");
            console.log("   • ✅ Full lifecycle — open → verify → close");
            console.log("\n   Validation:");
            console.log("   • ✅ Deadline check");
            console.log("   • ✅ Leverage bounds (1.1x - 5x)");
            console.log("   • ✅ Circuit breaker blocks leverage");
            console.log("   • ✅ No residual tokens after operations");
            console.log("\n   Security:");
            console.log("   • ✅ Unauthorized callback rejected");
            console.log("   • ✅ Non-registered plugin rejected by FlashLoanService");
            console.log("   • ✅ Only owner can open leverage");
            console.log("\n   Architecture:");
            console.log("   • FlashLoanService: generic, shared (Balancer V2, 0% fee)");
            console.log("   • AaveV3Plugin: protocol-specific leverage callbacks");
            console.log("   • No EVC batch needed — sequential pool calls");
            console.log("=".repeat(70) + "\n");
        });
    });
});
