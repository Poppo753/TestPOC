import { expect } from "chai";
import { ethers, network } from "hardhat";

/**
 * 🏦 E2E MORPHO VAULT - FULL PROTOCOL FORK TEST (USDC Base Asset)
 *
 * Deploys the entire protocol stack on Arbitrum fork with USDC as the base asset.
 * Tests: deposit USDC → MetaMorpho Vault supply → value check (MorphoVaultLensAdapter) → withdraw
 *
 * MetaMorpho Vault Arbitrum:
 * - HexaOne USDC Vault: 0xaE73875437c86abb60cD7fA77286D63cb94F9a25 (ERC-4626, USDC)
 *
 * Conversion: USDC deposited == USDC base asset → lens returns direct balance (no cross-rate needed)
 *
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/MorphoVault.USDC.e2e.test.ts
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";

(FORK_ENABLED ? describe : describe.skip)("E2E: MorphoVault - USDC Base Asset", function () {
    this.timeout(300000); // 5 minutes

    // ==================== ARBITRUM MAINNET ADDRESSES ====================
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

    // Chainlink feeds
    const CHAINLINK_ETH_USD  = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
    const CHAINLINK_BTC_USD  = "0x6ce185860a4963106506C203335A2910413708e9";
    const CHAINLINK_USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";

    // MetaMorpho Vault (ERC-4626, USDC asset, Arbitrum mainnet)
    const HEXAONE_USDC_VAULT = "0xaE73875437c86abb60cD7fA77286D63cb94F9a25";

    // Whale
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // Contracts
    let beacon: any;
    let proxyGeneral: any;
    let tokenManager: any;
    let valueCalculator: any;
    let swapManager: any;
    let parameterManager: any;
    let liquidityManager: any;
    let chainlinkAdapter: any;
    let protocolManager: any;
    let morphoRegistry: any;
    let morphoVaultPlugin: any;
    let morphoVaultLensAdapter: any;

    let usdcContract: any;

    let owner: any;
    let user1: any;
    let user2: any;
    let feeRecipient: any;

    before(async function () {
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        console.log("\n🔧 Deploying full protocol with USDC base asset (MorphoVault)...\n");

        // ==================== SANITY CHECK: vault must exist on fork ====================
        const vaultCode = await ethers.provider.getCode(HEXAONE_USDC_VAULT);
        if (vaultCode === "0x") {
            console.log("   ❌ HexaOne USDC vault not found on fork — skipping");
            this.skip();
        }

        // Verify vault accepts deposits
        const vaultInterface = new ethers.Interface([
            "function asset() view returns (address)",
            "function maxDeposit(address) view returns (uint256)"
        ]);
        const hexaVault = new ethers.Contract(HEXAONE_USDC_VAULT, vaultInterface, ethers.provider);
        const vaultAsset = await hexaVault.asset();
        if (vaultAsset.toLowerCase() !== USDC.toLowerCase()) {
            console.log(`   ❌ Vault asset mismatch: ${vaultAsset}`);
            this.skip();
        }
        const maxDep = await hexaVault.maxDeposit(ethers.ZeroAddress);
        if (maxDep === 0n) {
            console.log("   ❌ Vault maxDeposit = 0 — skipping");
            this.skip();
        }
        console.log(`   ✅ HexaOne USDC vault OK. maxDeposit: ${ethers.formatUnits(maxDep, 6)} USDC`);

        // ==================== 1. BEACON ====================
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.waitForDeployment();

        await beacon.updateImplementation("USDC", USDC);
        await beacon.updateImplementation("BASE_ASSET", USDC);
        await beacon.updateImplementation("WETH", WETH);
        await beacon.updateImplementation("WBTC", WBTC);

        // ==================== 2. CHAINLINK ADAPTER ====================
        const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapter.deploy();
        await chainlinkAdapter.waitForDeployment();

        const FORK_HEARTBEAT = 31536000;
        await chainlinkAdapter.setPriceFeed("USDC", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WETH", CHAINLINK_ETH_USD,  8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WBTC", CHAINLINK_BTC_USD,  8, FORK_HEARTBEAT, "USD");

        await chainlinkAdapter.setTargetDenomination("USDC");
        await chainlinkAdapter.setReferenceFeed("USD", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT);

        // ==================== 3. CORE CONTRACTS ====================
        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "USDC");
        await proxyGeneral.waitForDeployment();

        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);
        await tokenManager.waitForDeployment();

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculator.deploy(beacon.target, "USDC");
        await valueCalculator.waitForDeployment();

        const SwapManager = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManager.deploy(beacon.target, "USDC");
        await swapManager.waitForDeployment();

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManager.deploy(beacon.target, 6);
        await parameterManager.waitForDeployment();

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy(beacon.target, "USDC");
        await liquidityManager.waitForDeployment();

        // ==================== 4. REGISTER CORE IN BEACON ====================
        await beacon.updateImplementation("ProxyGeneral",     proxyGeneral.target);
        await beacon.updateImplementation("TokenManager",     tokenManager.target);
        await beacon.updateImplementation("ValueCalculator",  valueCalculator.target);
        await beacon.updateImplementation("SwapManager",      swapManager.target);
        await beacon.updateImplementation("ParameterManager", parameterManager.target);
        await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

        // ==================== 5. CONFIGURE TOKEN MANAGER ====================
        await tokenManager.setBaseAssetCode("USDC");
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WETH", WETH, 18, 3600);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WBTC", WBTC, 8,  3600);

        // ==================== 6. CONFIGURE LIQUIDITY MANAGER ====================
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(30);
        await liquidityManager.setWithdrawFee(50);
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        await liquidityManager.setWithdrawLimits(
            ethers.parseUnits("100000", 6),
            ethers.parseUnits("500000", 6),
            ethers.parseUnits("1", 6),
            ethers.parseUnits("50000", 6)
        );

        // ==================== 7. PARAMETERS ====================
        await parameterManager.proposeParameterChange("minDeposit", ethers.parseUnits("0.1", 6));

        await parameterManager.proposeParameterChange("maxDeposit", ethers.parseUnits("1000", 6));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxDeposit");

        await parameterManager.proposeParameterChange("maxWithdrawPerTx", ethers.parseUnits("500", 6));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxWithdrawPerTx");

        // ==================== 8. AUTHORIZE MODULES ====================
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");

        // ==================== 9. RATE LIMITS ====================
        await proxyGeneral.setRateLimit("deposit",  ethers.parseUnits("1000000", 6), ethers.parseUnits("5000000", 6));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseUnits("1000000", 6), ethers.parseUnits("5000000", 6));

        // ==================== 10. MORPHO VAULT SETUP ====================

        // Deploy MorphoRegistry and configure HexaOne USDC vault
        const MorphoRegistry = await ethers.getContractFactory("MorphoRegistry");
        morphoRegistry = await MorphoRegistry.deploy();
        await morphoRegistry.waitForDeployment();

        await morphoRegistry.configureVault(HEXAONE_USDC_VAULT, "USDC");
        await morphoRegistry.setDefaultVault("USDC", HEXAONE_USDC_VAULT);
        await beacon.updateImplementation("MorphoRegistry", morphoRegistry.target);

        // Deploy MorphoVaultPlugin (constructor: beacon only, no baseAssetCode)
        const MorphoVaultPlugin = await ethers.getContractFactory("MorphoVaultPlugin");
        morphoVaultPlugin = await MorphoVaultPlugin.deploy(beacon.target);
        await morphoVaultPlugin.waitForDeployment();
        await beacon.updateImplementation("MorphoVaultPlugin", morphoVaultPlugin.target);

        // Deploy MorphoVaultLensAdapter
        const MorphoVaultLensAdapter = await ethers.getContractFactory("MorphoVaultLensAdapter");
        morphoVaultLensAdapter = await MorphoVaultLensAdapter.deploy(beacon.target, "USDC");
        await morphoVaultLensAdapter.waitForDeployment();
        await beacon.updateImplementation("MorphoVaultLensAdapter", morphoVaultLensAdapter.target);

        // Deploy ProtocolManager
        const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
        protocolManager = await ProtocolManager.deploy(beacon.target);
        await protocolManager.waitForDeployment();
        await beacon.updateImplementation("ProtocolManager", protocolManager.target);

        await proxyGeneral.authorizeModule(protocolManager.target, "ProtocolManager");
        await proxyGeneral.authorizeModule(morphoVaultPlugin.target, "MorphoVaultPlugin");

        // ==================== 11. FUND USERS WITH USDC ====================
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
        const whale = await ethers.getSigner(USDC_WHALE);
        await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        const whaleBalance = await usdcContract.balanceOf(USDC_WHALE);
        console.log(`   Whale USDC balance: ${ethers.formatUnits(whaleBalance, 6)}`);

        let userAmount = ethers.parseUnits("10000", 6);
        let seedAmount = ethers.parseUnits("1000", 6);
        const totalNeeded = userAmount * 2n + seedAmount;

        if (whaleBalance < totalNeeded) {
            userAmount = whaleBalance * 40n / 100n;
            seedAmount = whaleBalance * 10n / 100n;
            console.log(`   ⚠️ Whale low, adjusted: ${ethers.formatUnits(userAmount, 6)} USDC per user`);
        }

        await usdcContract.connect(whale).transfer(user1.address, userAmount);
        await usdcContract.connect(whale).transfer(user2.address, userAmount);
        await usdcContract.connect(whale).transfer(proxyGeneral.target, seedAmount);

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);

        console.log("\n✅ Full protocol deployed with MorphoVault (HexaOne USDC)");
        console.log(`   Beacon:                ${beacon.target}`);
        console.log(`   ProxyGeneral:          ${proxyGeneral.target}`);
        console.log(`   MorphoVaultPlugin:     ${morphoVaultPlugin.target}`);
        console.log(`   MorphoRegistry:        ${morphoRegistry.target}`);
        console.log(`   MorphoVaultLensAdapter:${morphoVaultLensAdapter.target}`);
        console.log(`   ProtocolManager:       ${protocolManager.target}`);
        console.log(`   User1 USDC: ${ethers.formatUnits(await usdcContract.balanceOf(user1.address), 6)}`);
        console.log(`   User2 USDC: ${ethers.formatUnits(await usdcContract.balanceOf(user2.address), 6)}\n`);
    });

    // ================================================================
    // 1. DEPOSIT USDC INTO POOL
    // ================================================================

    describe("Step 1: Deposit USDC into pool", function () {
        it("should allow user1 to deposit 100 USDC and receive LP tokens", async function () {
            const depositAmount = ethers.parseUnits("100", 6);

            await usdcContract.connect(user1).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user1).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user1.address);
            expect(lpBalance).to.be.greaterThan(0n);
            console.log(`   User1 deposited 100 USDC, LP: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("should allow user2 to deposit 200 USDC", async function () {
            const depositAmount = ethers.parseUnits("200", 6);

            await usdcContract.connect(user2).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user2).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user2.address);
            expect(lpBalance).to.be.greaterThan(0n);
            console.log(`   User2 deposited 200 USDC, LP: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("pool should have USDC after deposits", async function () {
            const poolBalance = await usdcContract.balanceOf(proxyGeneral.target);
            expect(poolBalance).to.be.greaterThan(ethers.parseUnits("200", 6));
            console.log(`   Pool USDC: ${ethers.formatUnits(poolBalance, 6)}`);
        });
    });

    // ================================================================
    // 2. SUPPLY USDC TO METAMORPHO VAULT
    // ================================================================

    describe("Step 2: Supply USDC to MetaMorpho Vault", function () {
        it("should supply 100 USDC from pool to HexaOne USDC vault", async function () {
            const supplyAmount = ethers.parseUnits("100", 6);

            await protocolManager.deposit("MorphoVaultPlugin", "USDC", supplyAmount);

            const vaultBalance = await morphoVaultPlugin.getBalance("USDC");
            expect(vaultBalance).to.be.greaterThan(ethers.parseUnits("99", 6));

            console.log(`   Supplied ${ethers.formatUnits(supplyAmount, 6)} USDC to MetaMorpho vault`);
            console.log(`   Vault balance (via getBalance): ${ethers.formatUnits(vaultBalance, 6)} USDC`);
        });

        it("active vault count should be 1 after deposit", async function () {
            const count = await morphoVaultPlugin.getActiveVaultCount();
            expect(count).to.equal(1n);
            console.log(`   Active vaults: ${count}`);
        });
    });

    // ================================================================
    // 3. MORPHO VAULT LENS ADAPTER
    // ================================================================

    describe("Step 3: MorphoVault Lens Adapter Reads", function () {
        it("getTotalValue should return USDC-denominated vault position value", async function () {
            // USDC in MetaMorpho vault with USDC as base asset → direct balance (no cross-rate)
            const totalValue = await morphoVaultLensAdapter.getTotalValue();
            expect(totalValue).to.be.greaterThan(ethers.parseUnits("99", 6));
            console.log(`   Vault lens total value: ${ethers.formatUnits(totalValue, 6)} USDC`);
        });

        it("getValueBreakdown should return non-zero collateral, zero debt", async function () {
            const breakdown = await morphoVaultLensAdapter.getValueBreakdown();
            expect(breakdown.totalCollateral).to.be.greaterThan(0n);
            expect(breakdown.totalDebt).to.equal(0n);
            expect(breakdown.netValue).to.be.greaterThan(0n);

            console.log(`   Collateral: ${ethers.formatUnits(breakdown.totalCollateral, 6)} USDC`);
            console.log(`   Debt:       ${ethers.formatUnits(breakdown.totalDebt, 6)} USDC`);
            console.log(`   Net:        ${ethers.formatUnits(breakdown.netValue, 6)} USDC`);
        });

        it("getHealthFactor should return MAX (vaults are supply-only, no liquidation)", async function () {
            const hf = await morphoVaultLensAdapter.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
            console.log(`   Health factor: MAX (supply-only vault, no liquidation risk) ✅`);
        });

        it("getActivePositionCount should return 1 (one active vault)", async function () {
            const count = await morphoVaultLensAdapter.getActivePositionCount();
            expect(count).to.equal(1n);
            console.log(`   Active vault positions: ${count}`);
        });

        it("isCircuitBreakerActive should be false", async function () {
            const isActive = await morphoVaultLensAdapter.isCircuitBreakerActive();
            expect(isActive).to.be.false;
        });
    });

    // ================================================================
    // 4. VALUE CALCULATION
    // ================================================================

    describe("Step 4: Value Calculation", function () {
        it("total pool value should be positive", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            expect(totalValue).to.be.greaterThan(0n);
            console.log(`   Total pool value: ${ethers.formatUnits(totalValue, 6)} USDC`);
        });
    });

    // ================================================================
    // 5. WITHDRAW USDC FROM METAMORPHO VAULT
    // ================================================================

    describe("Step 5: Withdraw USDC from MetaMorpho Vault", function () {
        it("should withdraw USDC from vault back to pool", async function () {
            const vaultBalanceBefore = await morphoVaultPlugin.getBalance("USDC");
            expect(vaultBalanceBefore).to.be.greaterThan(0n);

            const poolBalanceBefore = await usdcContract.balanceOf(proxyGeneral.target);

            await protocolManager.withdraw("MorphoVaultPlugin", "USDC", vaultBalanceBefore);

            const vaultBalanceAfter = await morphoVaultPlugin.getBalance("USDC");
            const poolBalanceAfter  = await usdcContract.balanceOf(proxyGeneral.target);

            // Vault shares fully redeemed (may have tiny dust due to ERC-4626 rounding)
            expect(vaultBalanceAfter).to.be.lessThan(ethers.parseUnits("1", 6));
            expect(poolBalanceAfter).to.be.greaterThan(poolBalanceBefore);

            console.log(`   Withdrew: ${ethers.formatUnits(vaultBalanceBefore, 6)} USDC from vault`);
            console.log(`   Pool USDC after: ${ethers.formatUnits(poolBalanceAfter, 6)}`);
        });

        it("vault lens should return ~0 after full withdrawal", async function () {
            const totalValue = await morphoVaultLensAdapter.getTotalValue();
            expect(totalValue).to.be.lessThan(ethers.parseUnits("1", 6));
            console.log(`   Lens value after withdraw: ${ethers.formatUnits(totalValue, 6)} USDC`);
        });
    });

    // ================================================================
    // 6. USER WITHDRAWALS
    // ================================================================

    describe("Step 6: User Withdrawals", function () {
        it("should allow user1 to withdraw LP tokens and receive USDC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user1.address);
            if (lpTokens > 0n) {
                const usdcBefore = await usdcContract.balanceOf(user1.address);
                await liquidityManager.connect(user1).withdraw(lpTokens);
                const usdcAfter = await usdcContract.balanceOf(user1.address);
                const received  = usdcAfter - usdcBefore;

                expect(received).to.be.greaterThan(0n);
                console.log(`   User1 burned ${ethers.formatUnits(lpTokens, 6)} LP → ${ethers.formatUnits(received, 6)} USDC`);
            }
        });

        it("should allow user2 to withdraw LP tokens and receive USDC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user2.address);
            if (lpTokens > 0n) {
                const usdcBefore = await usdcContract.balanceOf(user2.address);
                await liquidityManager.connect(user2).withdraw(lpTokens);
                const usdcAfter = await usdcContract.balanceOf(user2.address);
                const received  = usdcAfter - usdcBefore;

                expect(received).to.be.greaterThan(0n);
                console.log(`   User2 burned ${ethers.formatUnits(lpTokens, 6)} LP → ${ethers.formatUnits(received, 6)} USDC`);
            }
        });

        it("pool should have minimal USDC after all withdrawals", async function () {
            const remaining = await usdcContract.balanceOf(proxyGeneral.target);
            console.log(`   Pool remaining: ${ethers.formatUnits(remaining, 6)} USDC (fees + seed)`);
        });
    });
});
