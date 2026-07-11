import { expect } from "chai";
import { ethers, network } from "hardhat";

/**
 * 🔵 E2E MORPHO BLUE - FULL PROTOCOL FORK TEST (WETH Base Asset)
 *
 * Deploys the entire protocol stack on Arbitrum fork with WETH as the base asset.
 * Tests: deposit WETH → Morpho Blue supplyCollateral → value check (MorphoLensAdapter) → withdrawCollateral
 *
 * Morpho Blue Arbitrum addresses:
 * - Morpho:   0x6c247b1F6182318877311737BaC0844bAa518F5e
 * - WETH/USDC 86% LLTV market:
 *   Oracle:   0x282FEB10549fde52bD61A6979424Ddf18A4971A2
 *   IRM:      0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA
 *   LLTV:     860000000000000000 (86%)
 *
 * Value conversion chain (no borrow, collateral only):
 *   WETH collateral → Morpho oracle → USDC value → TokenManager → WETH value ≈ deposited WETH
 *
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/Morpho.WETH.e2e.test.ts
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";

(FORK_ENABLED ? describe : describe.skip)("E2E: Morpho Blue - WETH Base Asset", function () {
    this.timeout(300000); // 5 minutes

    // ==================== ARBITRUM MAINNET ADDRESSES ====================
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

    // Chainlink feeds
    const CHAINLINK_ETH_USD  = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
    const CHAINLINK_BTC_USD  = "0x6ce185860a4963106506C203335A2910413708e9";
    const CHAINLINK_USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";

    // Morpho Blue
    const MORPHO_BLUE   = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
    const MORPHO_ORACLE = "0x282FEB10549fde52bD61A6979424Ddf18A4971A2";
    const MORPHO_IRM    = "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA";
    const MORPHO_LLTV   = "860000000000000000"; // 86%

    // Whale — large WETH holder on Arbitrum (Aave aWETH)
    const WETH_WHALE = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";

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
    let morphoPlugin: any;
    let morphoLensAdapter: any;

    let wethContract: any;

    let owner: any;
    let user1: any;
    let user2: any;
    let feeRecipient: any;

    before(async function () {
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        console.log("\n🔧 Deploying full protocol with WETH base asset (Morpho Blue)...\n");

        // ==================== 1. BEACON ====================
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.waitForDeployment();

        await beacon.updateImplementation("USDC", USDC);
        await beacon.updateImplementation("BASE_ASSET", WETH);
        await beacon.updateImplementation("WETH", WETH);
        await beacon.updateImplementation("WBTC", WBTC);

        // ==================== 2. CHAINLINK ADAPTER ====================
        const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapter.deploy();
        await chainlinkAdapter.waitForDeployment();

        const FORK_HEARTBEAT = 31536000; // 1 year (fork data may be stale)
        await chainlinkAdapter.setPriceFeed("USDC", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WETH", CHAINLINK_ETH_USD,  8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WBTC", CHAINLINK_BTC_USD,  8, FORK_HEARTBEAT, "USD");

        // Target denomination = WETH; reference feed = ETH/USD
        await chainlinkAdapter.setTargetDenomination("WETH");
        await chainlinkAdapter.setReferenceFeed("USD", CHAINLINK_ETH_USD, 8, FORK_HEARTBEAT);

        // ==================== 3. CORE CONTRACTS ====================
        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "WETH");
        await proxyGeneral.waitForDeployment();

        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);
        await tokenManager.waitForDeployment();

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculator.deploy(beacon.target, "WETH");
        await valueCalculator.waitForDeployment();

        const SwapManager = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManager.deploy(beacon.target, "WETH");
        await swapManager.waitForDeployment();

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManager.deploy(beacon.target, 18); // WETH = 18 decimals
        await parameterManager.waitForDeployment();

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy(beacon.target, "WETH");
        await liquidityManager.waitForDeployment();

        // ==================== 4. REGISTER CORE IN BEACON ====================
        await beacon.updateImplementation("ProxyGeneral",     proxyGeneral.target);
        await beacon.updateImplementation("TokenManager",     tokenManager.target);
        await beacon.updateImplementation("ValueCalculator",  valueCalculator.target);
        await beacon.updateImplementation("SwapManager",      swapManager.target);
        await beacon.updateImplementation("ParameterManager", parameterManager.target);
        await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

        // ==================== 5. CONFIGURE TOKEN MANAGER ====================
        await tokenManager.setBaseAssetCode("WETH");
        // USDC and WBTC as tradeable tokens; WETH is BASE_ASSET and not registered
        // USDC registered so MorphoLensAdapter can do the USDC→WETH cross-rate conversion
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("USDC", USDC, 6, 3600);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WBTC", WBTC, 8, 3600);

        // ==================== 6. CONFIGURE LIQUIDITY MANAGER ====================
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(30);
        await liquidityManager.setWithdrawFee(50);
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        await liquidityManager.setWithdrawLimits(
            ethers.parseUnits("100",   18),  // hourly
            ethers.parseUnits("500",   18),  // daily
            ethers.parseUnits("0.001", 18),  // min withdraw
            ethers.parseUnits("50",    18)   // max per tx
        );

        // ==================== 7. PARAMETERS ====================
        await parameterManager.proposeParameterChange("minDeposit", ethers.parseUnits("0.0001", 18));

        await parameterManager.proposeParameterChange("maxDeposit", ethers.parseUnits("1000", 18));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxDeposit");

        await parameterManager.proposeParameterChange("maxWithdrawPerTx", ethers.parseUnits("500", 18));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxWithdrawPerTx");

        // ==================== 8. AUTHORIZE MODULES ====================
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");

        // ==================== 9. RATE LIMITS ====================
        await proxyGeneral.setRateLimit("deposit",  ethers.parseUnits("1000000", 18), ethers.parseUnits("5000000", 18));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseUnits("1000000", 18), ethers.parseUnits("5000000", 18));

        // ==================== 10. MORPHO BLUE SETUP ====================

        // Deploy MorphoRegistry and configure WETH/USDC 86% market
        const MorphoRegistry = await ethers.getContractFactory("MorphoRegistry");
        morphoRegistry = await MorphoRegistry.deploy();
        await morphoRegistry.waitForDeployment();

        await morphoRegistry.configureMarket(
            "WETH", "USDC",
            WETH, USDC,
            MORPHO_ORACLE, MORPHO_IRM, MORPHO_LLTV
        );
        await beacon.updateImplementation("MorphoRegistry", morphoRegistry.target);

        // Deploy MorphoPlugin
        const MorphoPlugin = await ethers.getContractFactory("MorphoPlugin");
        morphoPlugin = await MorphoPlugin.deploy(beacon.target, "WETH", MORPHO_BLUE);
        await morphoPlugin.waitForDeployment();
        await beacon.updateImplementation("MorphoPlugin", morphoPlugin.target);

        // Deploy MorphoLensAdapter
        const MorphoLensAdapter = await ethers.getContractFactory("MorphoLensAdapter");
        morphoLensAdapter = await MorphoLensAdapter.deploy(beacon.target, "WETH", MORPHO_BLUE);
        await morphoLensAdapter.waitForDeployment();
        await beacon.updateImplementation("MorphoLensAdapter", morphoLensAdapter.target);

        // Deploy ProtocolManager
        const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
        protocolManager = await ProtocolManager.deploy(beacon.target);
        await protocolManager.waitForDeployment();
        await beacon.updateImplementation("ProtocolManager", protocolManager.target);

        // Authorize ProtocolManager in ProxyGeneral (for withdrawToken calls)
        await proxyGeneral.authorizeModule(protocolManager.target, "ProtocolManager");
        // Authorize MorphoPlugin in ProxyGeneral
        await proxyGeneral.authorizeModule(morphoPlugin.target, "MorphoPlugin");

        // ==================== 11. FUND USERS WITH WETH ====================
        wethContract = await ethers.getContractAt("IERC20", WETH);

        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        const whale = await ethers.getSigner(WETH_WHALE);
        await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        const whaleBalance = await wethContract.balanceOf(WETH_WHALE);
        console.log(`   Whale WETH balance: ${ethers.formatUnits(whaleBalance, 18)}`);

        let userAmount = ethers.parseUnits("1", 18);    // 1 WETH per user
        let seedAmount = ethers.parseUnits("0.1", 18);  // 0.1 WETH seed
        const totalNeeded = userAmount * 2n + seedAmount;

        if (whaleBalance < totalNeeded) {
            userAmount = whaleBalance * 40n / 100n;
            seedAmount = whaleBalance * 10n / 100n;
            console.log(`   ⚠️ Whale low, adjusted: ${ethers.formatUnits(userAmount, 18)} WETH per user`);
        }

        await wethContract.connect(whale).transfer(user1.address, userAmount);
        await wethContract.connect(whale).transfer(user2.address, userAmount);
        await wethContract.connect(whale).transfer(proxyGeneral.target, seedAmount);

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);

        console.log("\n✅ Full protocol deployed with Morpho Blue (WETH/USDC market)");
        console.log(`   Beacon:             ${beacon.target}`);
        console.log(`   ProxyGeneral:       ${proxyGeneral.target}`);
        console.log(`   MorphoPlugin:       ${morphoPlugin.target}`);
        console.log(`   MorphoRegistry:     ${morphoRegistry.target}`);
        console.log(`   MorphoLensAdapter:  ${morphoLensAdapter.target}`);
        console.log(`   ProtocolManager:    ${protocolManager.target}`);
        console.log(`   User1 WETH: ${ethers.formatUnits(await wethContract.balanceOf(user1.address), 18)}`);
        console.log(`   User2 WETH: ${ethers.formatUnits(await wethContract.balanceOf(user2.address), 18)}\n`);
    });

    // ================================================================
    // 1. DEPOSIT WETH INTO POOL
    // ================================================================

    describe("Step 1: Deposit WETH into pool", function () {
        it("should allow user1 to deposit 0.1 WETH and receive LP tokens", async function () {
            const depositAmount = ethers.parseUnits("0.1", 18);

            await wethContract.connect(user1).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user1).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user1.address);
            expect(lpBalance).to.be.greaterThan(0n);

            console.log(`   User1 deposited 0.1 WETH, LP: ${ethers.formatUnits(lpBalance, 18)}`);
        });

        it("should allow user2 to deposit 0.2 WETH", async function () {
            const depositAmount = ethers.parseUnits("0.2", 18);

            await wethContract.connect(user2).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user2).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user2.address);
            expect(lpBalance).to.be.greaterThan(0n);

            console.log(`   User2 deposited 0.2 WETH, LP: ${ethers.formatUnits(lpBalance, 18)}`);
        });

        it("pool should have WETH after deposits", async function () {
            const poolBalance = await wethContract.balanceOf(proxyGeneral.target);
            expect(poolBalance).to.be.greaterThan(ethers.parseUnits("0.2", 18));
            console.log(`   Pool WETH: ${ethers.formatUnits(poolBalance, 18)}`);
        });
    });

    // ================================================================
    // 2. SUPPLY WETH COLLATERAL TO MORPHO
    // ================================================================

    describe("Step 2: Supply WETH collateral to Morpho Blue", function () {
        it("should supply 0.05 WETH from pool to Morpho WETH/USDC market", async function () {
            const supplyAmount = ethers.parseUnits("0.05", 18);

            await protocolManager.deposit("MorphoPlugin", "WETH", supplyAmount);

            const collateral = await morphoPlugin.getCollateral("WETH", "USDC");
            expect(collateral).to.be.greaterThanOrEqual(supplyAmount);

            console.log(`   Supplied: ${ethers.formatUnits(supplyAmount, 18)} WETH to Morpho`);
            console.log(`   Morpho collateral (via getCollateral): ${ethers.formatUnits(collateral, 18)} WETH`);
        });

        it("health factor should be MAX (no borrow)", async function () {
            const hf = await morphoPlugin.getHealthFactor("WETH", "USDC");
            expect(hf).to.equal(ethers.MaxUint256);
            console.log(`   Health factor: MAX (no borrow) ✅`);
        });
    });

    // ================================================================
    // 3. MORPHO LENS ADAPTER
    // ================================================================

    describe("Step 3: Morpho Lens Adapter Reads", function () {
        it("getTotalValue should return WETH-denominated value of collateral", async function () {
            // Morpho oracle: WETH collateral → USDC value → TokenManager USDC/WETH → WETH value ≈ deposit
            const totalValue = await morphoLensAdapter.getTotalValue();
            expect(totalValue).to.be.greaterThan(0n);

            // Value should be close to the deposited 0.05 WETH (±20% tolerance for price differences)
            const depositedWeth = ethers.parseUnits("0.05", 18);
            expect(totalValue).to.be.greaterThan(depositedWeth * 80n / 100n);
            expect(totalValue).to.be.lessThan(depositedWeth * 120n / 100n);

            console.log(`   Morpho lens total value: ${ethers.formatUnits(totalValue, 18)} WETH`);
        });

        it("getValueBreakdown should return non-zero collateral and zero debt", async function () {
            const breakdown = await morphoLensAdapter.getValueBreakdown();
            expect(breakdown.totalCollateral).to.be.greaterThan(0n);
            expect(breakdown.totalDebt).to.equal(0n);
            expect(breakdown.netValue).to.be.greaterThan(0n);

            console.log(`   Collateral: ${ethers.formatUnits(breakdown.totalCollateral, 18)} WETH`);
            console.log(`   Debt:       ${ethers.formatUnits(breakdown.totalDebt, 18)} WETH`);
            console.log(`   Net:        ${ethers.formatUnits(breakdown.netValue, 18)} WETH`);
        });

        it("getHealthFactor (lens) should return MAX (no debt)", async function () {
            const hf = await morphoLensAdapter.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
        });

        it("getActivePositionCount should return 1 (one active collateral market)", async function () {
            // Morpho counts any market with collateral > 0 or borrowShares > 0 as a position
            const count = await morphoLensAdapter.getActivePositionCount();
            expect(count).to.equal(1n);
            console.log(`   Active Morpho market positions: ${count}`);
        });

        it("isCircuitBreakerActive should be false", async function () {
            const isActive = await morphoLensAdapter.isCircuitBreakerActive();
            expect(isActive).to.be.false;
        });
    });

    // ================================================================
    // 4. VALUE CALCULATION
    // ================================================================

    describe("Step 4: Value Calculation", function () {
        it("pool total value should be positive", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            expect(totalValue).to.be.greaterThan(0n);
            console.log(`   Total pool value: ${ethers.formatUnits(totalValue, 18)} WETH`);
        });
    });

    // ================================================================
    // 5. WITHDRAW WETH FROM MORPHO
    // ================================================================

    describe("Step 5: Withdraw WETH collateral from Morpho", function () {
        it("should withdraw WETH collateral from Morpho back to pool", async function () {
            const collateralBefore = await morphoPlugin.getCollateral("WETH", "USDC");
            expect(collateralBefore).to.be.greaterThan(0n);

            const poolBalanceBefore = await wethContract.balanceOf(proxyGeneral.target);

            await protocolManager.withdraw("MorphoPlugin", "WETH", collateralBefore);

            const collateralAfter = await morphoPlugin.getCollateral("WETH", "USDC");
            const poolBalanceAfter = await wethContract.balanceOf(proxyGeneral.target);

            expect(collateralAfter).to.equal(0n);
            expect(poolBalanceAfter).to.be.greaterThan(poolBalanceBefore);

            console.log(`   Withdrew: ${ethers.formatUnits(collateralBefore, 18)} WETH from Morpho`);
            console.log(`   Pool WETH after: ${ethers.formatUnits(poolBalanceAfter, 18)}`);
        });

        it("Morpho lens should return 0 after full withdrawal", async function () {
            const totalValue = await morphoLensAdapter.getTotalValue();
            expect(totalValue).to.equal(0n);
            console.log(`   Lens value after withdraw: ${ethers.formatUnits(totalValue, 18)} WETH`);
        });
    });

    // ================================================================
    // 6. USER WITHDRAWALS
    // ================================================================

    describe("Step 6: User Withdrawals", function () {
        it("should allow user1 to withdraw LP tokens and receive WETH", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user1.address);
            if (lpTokens > 0n) {
                const wethBefore = await wethContract.balanceOf(user1.address);
                await liquidityManager.connect(user1).withdraw(lpTokens);
                const wethAfter = await wethContract.balanceOf(user1.address);
                const received = wethAfter - wethBefore;

                expect(received).to.be.greaterThan(0n);
                console.log(`   User1 burned ${ethers.formatUnits(lpTokens, 18)} LP → ${ethers.formatUnits(received, 18)} WETH`);
            }
        });

        it("should allow user2 to withdraw LP tokens and receive WETH", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user2.address);
            if (lpTokens > 0n) {
                const wethBefore = await wethContract.balanceOf(user2.address);
                await liquidityManager.connect(user2).withdraw(lpTokens);
                const wethAfter = await wethContract.balanceOf(user2.address);
                const received = wethAfter - wethBefore;

                expect(received).to.be.greaterThan(0n);
                console.log(`   User2 burned ${ethers.formatUnits(lpTokens, 18)} LP → ${ethers.formatUnits(received, 18)} WETH`);
            }
        });

        it("pool should have minimal WETH after all withdrawals", async function () {
            const remaining = await wethContract.balanceOf(proxyGeneral.target);
            console.log(`   Pool remaining: ${ethers.formatUnits(remaining, 18)} WETH (fees + seed)`);
        });
    });
});
